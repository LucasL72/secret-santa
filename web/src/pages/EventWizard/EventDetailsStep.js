import { useEffect, useState } from 'react';

function EventDetailsStep({
  initialValues,
  onSubmit,
  onCancel = () => {},
  externalErrors = {},
}) {
  const [values, setValues] = useState(initialValues);
  const [errors, setErrors] = useState({});

  useEffect(() => {
    setErrors(externalErrors || {});
  }, [externalErrors]);

  const validate = () => {
    const nextErrors = {};

    if (!values.title.trim()) {
      nextErrors.title = 'Indiquez un nom reconnaissable pour votre évènement.';
    }

    if (!values.deadline) {
      nextErrors.deadline = 'La date limite est obligatoire.';
    } else {
      const deadlineDate = new Date(values.deadline);
      const now = new Date();
      now.setHours(0, 0, 0, 0);
      if (Number.isNaN(deadlineDate.getTime())) {
        nextErrors.deadline = 'La date limite doit être valide.';
      } else if (deadlineDate < now) {
        nextErrors.deadline = 'La date doit être dans le futur.';
      }
    }

    if (!values.budget) {
      nextErrors.budget = 'Le budget maximum est obligatoire.';
    } else if (Number.isNaN(Number(values.budget)) || Number(values.budget) <= 0) {
      nextErrors.budget = 'Le budget doit être un montant positif.';
    }

    if (!values.location.trim()) {
      nextErrors.location = 'Merci de préciser le lieu de remise des cadeaux.';
    }

    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  };

  const handleChange = (event) => {
    const { name, value } = event.target;
    setValues((prev) => ({ ...prev, [name]: value }));
    setErrors((prev) => {
      if (!prev[name]) {
        return prev;
      }
      const nextErrors = { ...prev };
      delete nextErrors[name];
      return nextErrors;
    });
  };

  const handleSubmit = (event) => {
    event.preventDefault();
    if (validate()) {
      onSubmit(values);
    }
  };

  return (
    <form className="d-flex flex-column gap-3" onSubmit={handleSubmit} noValidate>
      <div>
        <label className="form-label" htmlFor="title">
          Nom de l’évènement
        </label>
        <input
          id="title"
          name="title"
          type="text"
          value={values.title}
          onChange={handleChange}
          placeholder="Secret Santa de la famille Dupont"
          className={`form-control${errors.title ? ' is-invalid' : ''}`}
        />
        {errors.title && <div className="form-error">{errors.title}</div>}
      </div>
      <div className="row g-4">
        <div className="col-md-6">
          <label className="form-label" htmlFor="deadline">
            Date limite d’envoi
          </label>
          <input
            id="deadline"
            name="deadline"
            type="date"
            value={values.deadline}
            onChange={handleChange}
            required
            className={`form-control${errors.deadline ? ' is-invalid' : ''}`}
          />
          {errors.deadline && <div className="form-error">{errors.deadline}</div>}
        </div>
        <div className="col-md-6">
          <label className="form-label" htmlFor="budget">
            Budget maximum (en €)
          </label>
          <input
            id="budget"
            name="budget"
            type="number"
            min="1"
            step="1"
            value={values.budget}
            onChange={handleChange}
            required
            className={`form-control${errors.budget ? ' is-invalid' : ''}`}
          />
          {errors.budget && <div className="form-error">{errors.budget}</div>}
        </div>
      </div>
      <div>
        <label className="form-label" htmlFor="location">
          Lieu de l’échange
        </label>
        <input
          id="location"
          name="location"
          type="text"
          value={values.location}
          onChange={handleChange}
          placeholder="Chez Mamie, 24 décembre"
          className={`form-control${errors.location ? ' is-invalid' : ''}`}
        />
        {errors.location && <div className="form-error">{errors.location}</div>}
      </div>
      <div className="form-actions">
        <button type="button" onClick={onCancel} className="btn btn-link">
          Annuler
        </button>
        <button type="submit" className="btn btn-primary">
          Continuer
        </button>
      </div>
    </form>
  );
}

export default EventDetailsStep;
