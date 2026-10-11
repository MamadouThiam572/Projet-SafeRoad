import { useState, type FormEvent, type ReactNode } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import logoUrl from '@/assets/images/saferoad-logo.png'
import {
  ApiError,
  changerMotDePasse,
  demanderReinitialisation,
  reinitialiserMotDePasse,
  type TypeCompte,
} from '@/lib/api'
import { PATHS } from '@/routes/paths'

/**
 * Parcours « mot de passe » : demande de lien (mot de passe oublié), choix du mot de passe
 * depuis le lien reçu par email (oubli ou invitation d'un nouveau compte), et formulaire de
 * changement intégré aux pages de profil. Le backend applique les règles de robustesse et
 * renvoie le message à afficher.
 */

const CHAMP =
  'w-full rounded-[11px] border-[1.5px] border-line-field bg-field px-3.5 py-3 text-sm font-medium text-ink outline-none focus:border-brand-600'
const BOUTON =
  'flex w-full items-center justify-center gap-2 rounded-full bg-brand-600 py-3.5 text-sm font-bold text-white transition-colors hover:bg-brand-700 disabled:cursor-wait disabled:opacity-70'

function typeDepuis(valeur: string | null): TypeCompte {
  return valeur === 'conducteur' ? 'conducteur' : 'personnel'
}

function messageDe(err: unknown, defaut: string): string {
  return err instanceof ApiError ? err.message : defaut
}

function CadreAuth({ titre, sousTitre, children }: { titre: string; sousTitre: string; children: ReactNode }) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-page px-4 py-12">
      <div className="w-full max-w-sm rounded-2xl border border-line bg-white p-7 shadow-card">
        <Link to={PATHS.home} className="mb-6 flex items-center">
          <img src={logoUrl} alt="SafeRoad Sénégal" className="block h-[44px] w-auto" />
        </Link>
        <h1 className="text-xl font-extrabold tracking-tight text-ink">{titre}</h1>
        <p className="mt-2 text-sm leading-relaxed text-body">{sousTitre}</p>
        <div className="mt-6">{children}</div>
        <p className="mt-6 text-center text-sm text-body">
          <Link to={PATHS.connexion} className="font-bold text-brand-600 hover:text-brand-700">
            Retour à la connexion
          </Link>
        </p>
      </div>
    </div>
  )
}

function Message({ type, children }: { type: 'erreur' | 'succes'; children: ReactNode }) {
  const style =
    type === 'erreur'
      ? 'border-danger-200 bg-danger-50 text-danger-700'
      : 'border-success-600 bg-success-50 text-brand-700'
  return (
    <div className={`flex items-start gap-2 rounded-[10px] border px-3.5 py-3 text-xs font-semibold ${style}`}>
      <span className="ic text-base">{type === 'erreur' ? 'error' : 'check_circle'}</span>
      <span>{children}</span>
    </div>
  )
}

/** PATHS.motDePasseOublie?type=conducteur|personnel — le type vient du profil choisi à la connexion. */
export function MotDePasseOubliePage() {
  const [params] = useSearchParams()
  const type = typeDepuis(params.get('type'))
  const [email, setEmail] = useState('')
  const [erreur, setErreur] = useState('')
  const [confirmation, setConfirmation] = useState('')
  const [envoi, setEnvoi] = useState(false)

  async function envoyer(e: FormEvent) {
    e.preventDefault()
    setErreur('')
    setEnvoi(true)
    try {
      setConfirmation((await demanderReinitialisation(type, email.trim())).detail)
    } catch (err) {
      setErreur(messageDe(err, 'Demande impossible pour le moment.'))
    } finally {
      setEnvoi(false)
    }
  }

  return (
    <CadreAuth
      titre="Mot de passe oublié"
      sousTitre="Indiquez l’adresse email de votre compte : nous vous enverrons un lien pour choisir un nouveau mot de passe."
    >
      {confirmation ? (
        <Message type="succes">{confirmation}</Message>
      ) : (
        <form onSubmit={envoyer} className="flex flex-col gap-4">
          <label className="block">
            <span className="mb-2 block text-xs font-bold text-body">ADRESSE EMAIL</span>
            <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" className={CHAMP} />
          </label>
          {erreur && <Message type="erreur">{erreur}</Message>}
          <button type="submit" disabled={envoi} className={BOUTON}>
            <span className="ic text-lg">mail</span>
            {envoi ? 'Envoi…' : 'Recevoir le lien'}
          </button>
        </form>
      )}
    </CadreAuth>
  )
}

/** PATHS.reinitialiserMotDePasse?type=…&uid=…&token=… — lien envoyé par email par le backend. */
export function ReinitialiserMotDePassePage() {
  const [params] = useSearchParams()
  const type = typeDepuis(params.get('type'))
  const uid = params.get('uid') ?? ''
  const token = params.get('token') ?? ''
  const [motDePasse, setMotDePasse] = useState('')
  const [confirmationMotDePasse, setConfirmationMotDePasse] = useState('')
  const [erreur, setErreur] = useState('')
  const [termine, setTermine] = useState('')
  const [envoi, setEnvoi] = useState(false)

  async function enregistrer(e: FormEvent) {
    e.preventDefault()
    if (motDePasse !== confirmationMotDePasse) {
      setErreur('Les deux mots de passe ne sont pas identiques.')
      return
    }
    setErreur('')
    setEnvoi(true)
    try {
      setTermine((await reinitialiserMotDePasse(type, uid, token, motDePasse)).detail)
    } catch (err) {
      setErreur(messageDe(err, 'Ce lien est invalide ou a expiré.'))
    } finally {
      setEnvoi(false)
    }
  }

  if (!uid || !token) {
    return (
      <CadreAuth titre="Lien incomplet" sousTitre="Ouvrez le lien tel qu’il figure dans l’email reçu, ou demandez-en un nouveau.">
        <Link to={`${PATHS.motDePasseOublie}?type=${type}`} className={BOUTON}>
          Demander un nouveau lien
        </Link>
      </CadreAuth>
    )
  }

  return (
    <CadreAuth
      titre="Choisir un mot de passe"
      sousTitre="Au moins 8 caractères, en évitant un mot de passe trop courant ou entièrement numérique."
    >
      {termine ? (
        <div className="flex flex-col gap-4">
          <Message type="succes">{termine}</Message>
          <Link to={PATHS.connexion} className={BOUTON}>
            Se connecter
          </Link>
        </div>
      ) : (
        <form onSubmit={enregistrer} className="flex flex-col gap-4">
          <label className="block">
            <span className="mb-2 block text-xs font-bold text-body">NOUVEAU MOT DE PASSE</span>
            <input type="password" required minLength={8} value={motDePasse} onChange={(e) => setMotDePasse(e.target.value)} autoComplete="new-password" className={CHAMP} />
          </label>
          <label className="block">
            <span className="mb-2 block text-xs font-bold text-body">CONFIRMER LE MOT DE PASSE</span>
            <input type="password" required minLength={8} value={confirmationMotDePasse} onChange={(e) => setConfirmationMotDePasse(e.target.value)} autoComplete="new-password" className={CHAMP} />
          </label>
          {erreur && (
            <Message type="erreur">
              {erreur}{' '}
              <Link to={`${PATHS.motDePasseOublie}?type=${type}`} className="underline">
                Demander un nouveau lien
              </Link>
            </Message>
          )}
          <button type="submit" disabled={envoi} className={BOUTON}>
            <span className="ic text-lg">lock_reset</span>
            {envoi ? 'Enregistrement…' : 'Enregistrer le mot de passe'}
          </button>
        </form>
      )}
    </CadreAuth>
  )
}

/** Formulaire « Modifier le mot de passe » des pages de profil (utilisateur connecté). */
export function ChangementMotDePasse({ type, onFermer }: { type: TypeCompte; onFermer: () => void }) {
  const [ancien, setAncien] = useState('')
  const [nouveau, setNouveau] = useState('')
  const [confirmationNouveau, setConfirmationNouveau] = useState('')
  const [erreur, setErreur] = useState('')
  const [termine, setTermine] = useState(false)
  const [envoi, setEnvoi] = useState(false)

  async function enregistrer(e: FormEvent) {
    e.preventDefault()
    if (nouveau !== confirmationNouveau) {
      setErreur('Les deux nouveaux mots de passe ne sont pas identiques.')
      return
    }
    setErreur('')
    setEnvoi(true)
    try {
      await changerMotDePasse(type, ancien, nouveau)
      setTermine(true)
    } catch (err) {
      setErreur(messageDe(err, 'Modification impossible pour le moment.'))
    } finally {
      setEnvoi(false)
    }
  }

  if (termine) {
    return (
      <div className="mt-4 flex flex-col gap-3">
        <Message type="succes">Mot de passe modifié.</Message>
        <button type="button" onClick={onFermer} className="self-start text-[12.5px] font-bold text-brand-600">
          Fermer
        </button>
      </div>
    )
  }

  return (
    <form onSubmit={enregistrer} className="mt-4 flex flex-col gap-3">
      <input type="password" required placeholder="Mot de passe actuel" value={ancien} onChange={(e) => setAncien(e.target.value)} autoComplete="current-password" className={CHAMP} />
      <input type="password" required minLength={8} placeholder="Nouveau mot de passe" value={nouveau} onChange={(e) => setNouveau(e.target.value)} autoComplete="new-password" className={CHAMP} />
      <input type="password" required minLength={8} placeholder="Confirmer le nouveau mot de passe" value={confirmationNouveau} onChange={(e) => setConfirmationNouveau(e.target.value)} autoComplete="new-password" className={CHAMP} />
      {erreur && <Message type="erreur">{erreur}</Message>}
      <div className="flex gap-2">
        <button type="submit" disabled={envoi} className="min-h-[44px] rounded-[9px] bg-brand-600 px-4 text-[12.5px] font-bold text-white hover:bg-brand-700 disabled:opacity-70">
          {envoi ? 'Enregistrement…' : 'Enregistrer'}
        </button>
        <button type="button" onClick={onFermer} className="min-h-[44px] rounded-[9px] border border-line px-4 text-[12.5px] font-bold text-body hover:bg-page">
          Annuler
        </button>
      </div>
    </form>
  )
}
