import { useState } from 'react';
import { loginCreator, registerCreator } from '../services/api';

const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function Auth({ onSuccess, onCancel = () => {} }) {
  const [mode, setMode] = useState('login');
  const [form, setForm] = useState({
    fullName: '',
    email: '',
    password: '',
    confirmPassword: '',
  });
  const [errors, setErrors] = useState({});
  const [serverError, setServerError] = useState('');
  const [loading, setLoading] = useState(false);

  const validate = () => {
    const nextErrors = {};

    if (!form.email) {
      nextErrors.email = 'Adresse e-mail obligatoire.';
    } else if (!emailRegex.test(form.email)) {
      nextErrors.email = 'Adresse e-mail invalide.';
    }

    if (!form.password || form.password.length < 8) {
      nextErrors.password =
        'Le mot de passe doit contenir au moins 8 caractères.';
    }

    if (mode === 'register') {
      if (!form.fullName.trim()) {
        nextErrors.fullName = 'Merci d’indiquer votre nom complet.';
      }
      if (!form.confirmPassword) {
        nextErrors.confirmPassword = 'Confirmez votre mot de passe.';
      } else if (form.password !== form.confirmPassword) {
        nextErrors.confirmPassword = 'Les mots de passe ne correspondent pas.';
      }
    }

    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  };

  const handleChange = (event) => {
    const { name, value } = event.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (!validate()) {
      return;
    }

    setLoading(true);
    setServerError('');

    try {
      const payload = {
        email: form.email,
        password: form.password,
      };

      if (mode === 'register') {
        const response = await registerCreator({
          ...payload,
          fullName: form.fullName.trim(),
        });
        if (onSuccess) {
          onSuccess(response);
        }
      } else {
        const response = await loginCreator(payload);
        if (onSuccess) {
          onSuccess(response);
        }
      }
    } catch (error) {
      setServerError(
        error?.message || 'Impossible de contacter le serveur pour le moment.'
      );
    } finally {
      setLoading(false);
    }
  };

  const switchMode = () => {
    setMode((prev) => (prev === 'login' ? 'register' : 'login'));
    setErrors({});
    setServerError('');
  };

  return (
    <section className="Auth">
      <header>
        <h1>{mode === 'login' ? 'Connexion' : 'Inscription'}</h1>
        <p>
          {mode === 'login'
            ? 'Connectez-vous pour configurer votre échange de cadeaux.'
            : 'Créez votre compte de créateur pour lancer un nouvel évènement.'}
        </p>
      </header>
      <form onSubmit={handleSubmit} noValidate>
        {mode === 'register' && (
          <div className="field">
            <label htmlFor="fullName">Nom complet</label>
            <input
              id="fullName"
              name="fullName"
              type="text"
              value={form.fullName}
              onChange={handleChange}
              autoComplete="name"
            />
            {errors.fullName && <span className="error">{errors.fullName}</span>}
          </div>
        )}
        <div className="field">
          <label htmlFor="email">Adresse e-mail</label>
          <input
            id="email"
            name="email"
            type="email"
            value={form.email}
            onChange={handleChange}
            autoComplete="email"
            required
          />
          {errors.email && <span className="error">{errors.email}</span>}
        </div>
        <div className="field">
          <label htmlFor="password">Mot de passe</label>
          <input
            id="password"
            name="password"
            type="password"
            value={form.password}
            onChange={handleChange}
            autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
            required
          />
          {errors.password && <span className="error">{errors.password}</span>}
        </div>
        {mode === 'register' && (
          <div className="field">
            <label htmlFor="confirmPassword">Confirmation du mot de passe</label>
            <input
              id="confirmPassword"
              name="confirmPassword"
              type="password"
              value={form.confirmPassword}
              onChange={handleChange}
              autoComplete="new-password"
              required
            />
            {errors.confirmPassword && (
              <span className="error">{errors.confirmPassword}</span>
            )}
          </div>
        )}
        {serverError && <div className="error" role="alert">{serverError}</div>}
        <div className="Auth-actions">
          <button type="submit" disabled={loading} className="primary">
            {loading ? 'Patientez…' : mode === 'login' ? 'Se connecter' : "S'inscrire"}
          </button>
          <button type="button" onClick={switchMode} disabled={loading}>
            {mode === 'login'
              ? "Pas encore de compte ? Inscrivez-vous"
              : 'Déjà inscrit ? Connectez-vous'}
          </button>
          <button type="button" onClick={onCancel} disabled={loading}>
            Annuler
          </button>
        </div>
      </form>
    </section>
  );
}

export default Auth;
