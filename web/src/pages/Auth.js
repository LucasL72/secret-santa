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
    <section className="auth-view py-5">
      <div className="container">
        <div className="row justify-content-center">
          <div className="col-lg-6 col-md-8">
            <div className="card shadow-lg">
              <div className="card-body">
                <header className="mb-4 text-center">
                  <h1 className="fs-3 mb-2">
                    {mode === 'login' ? 'Connexion' : 'Inscription'} festive
                  </h1>
                  <p className="text-muted mb-0">
                    {mode === 'login'
                      ? 'Connectez-vous pour configurer votre échange de cadeaux.'
                      : 'Créez votre compte de créateur pour lancer un nouvel évènement.'}
                  </p>
                </header>
                <form onSubmit={handleSubmit} noValidate className="d-flex flex-column gap-3">
                  {mode === 'register' && (
                    <div>
                      <label className="form-label" htmlFor="fullName">
                        Nom complet
                      </label>
                      <input
                        id="fullName"
                        name="fullName"
                        type="text"
                        value={form.fullName}
                        onChange={handleChange}
                        autoComplete="name"
                        className="form-control"
                      />
                      {errors.fullName && <div className="form-error">{errors.fullName}</div>}
                    </div>
                  )}
                  <div>
                    <label className="form-label" htmlFor="email">
                      Adresse e-mail
                    </label>
                    <input
                      id="email"
                      name="email"
                      type="email"
                      value={form.email}
                      onChange={handleChange}
                      autoComplete="email"
                      required
                      className="form-control"
                    />
                    {errors.email && <div className="form-error">{errors.email}</div>}
                  </div>
                  <div>
                    <label className="form-label" htmlFor="password">
                      Mot de passe
                    </label>
                    <input
                      id="password"
                      name="password"
                      type="password"
                      value={form.password}
                      onChange={handleChange}
                      autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
                      required
                      className="form-control"
                    />
                    <div className="form-text">
                      Minimum 8 caractères avec une touche de magie.
                    </div>
                    {errors.password && <div className="form-error">{errors.password}</div>}
                  </div>
                  {mode === 'register' && (
                    <div>
                      <label className="form-label" htmlFor="confirmPassword">
                        Confirmation du mot de passe
                      </label>
                      <input
                        id="confirmPassword"
                        name="confirmPassword"
                        type="password"
                        value={form.confirmPassword}
                        onChange={handleChange}
                        autoComplete="new-password"
                        required
                        className="form-control"
                      />
                      {errors.confirmPassword && (
                        <div className="form-error">{errors.confirmPassword}</div>
                      )}
                    </div>
                  )}
                  {serverError && (
                    <div className="alert" role="alert">
                      {serverError}
                    </div>
                  )}
                  <div className="form-actions">
                    <button type="submit" disabled={loading} className="btn btn-primary w-100">
                      {loading ? 'Patientez…' : mode === 'login' ? 'Se connecter' : "S'inscrire"}
                    </button>
                    <button
                      type="button"
                      onClick={switchMode}
                      disabled={loading}
                      className="btn btn-ghost w-100"
                    >
                      {mode === 'login'
                        ? "Pas encore de compte ? Inscrivez-vous"
                        : 'Déjà inscrit ? Connectez-vous'}
                    </button>
                    <button
                      type="button"
                      onClick={onCancel}
                      disabled={loading}
                      className="btn btn-link w-100"
                    >
                      Annuler
                    </button>
                  </div>
                </form>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

export default Auth;
