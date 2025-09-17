import { useState } from 'react';

function EventDetailsStep({ initialValues, onSubmit, onCancel = () => {} }) {
  const [values, setValues] = useState(initialValues);
  const [errors, setErrors] = useState({});

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
  };

  const handleSubmit = (event) => {
    event.preventDefault();
    if (validate()) {
      onSubmit(values);
    }
  };

  return (
    <form className="EventDetailsStep" onSubmit={handleSubmit} noValidate>
      <div className="field">
        <label htmlFor="title">Nom de l’évènement</label>
        <input
          id="title"
          name="title"
          type="text"
          value={values.title}
          onChange={handleChange}
          placeholder="Secret Santa de la famille Dupont"
        />
        {errors.title && <span className="error">{errors.title}</span>}
      </div>
      <div className="field">
        <label htmlFor="deadline">Date limite d’envoi</label>
        <input
          id="deadline"
          name="deadline"
          type="date"
          value={values.deadline}
          onChange={handleChange}
          required
        />
        {errors.deadline && <span className="error">{errors.deadline}</span>}
      </div>
      <div className="field">
        <label htmlFor="budget">Budget maximum (en €)</label>
        <input
          id="budget"
          name="budget"
          type="number"
          min="1"
          step="1"
          value={values.budget}
          onChange={handleChange}
          required
        />
        {errors.budget && <span className="error">{errors.budget}</span>}
      </div>
      <div className="field">
        <label htmlFor="location">Lieu de l’échange</label>
        <input
          id="location"
          name="location"
          type="text"
          value={values.location}
          onChange={handleChange}
          placeholder="Chez Mamie, 24 décembre"
        />
        {errors.location && <span className="error">{errors.location}</span>}
      </div>
      <div className="form-actions">
        <button type="button" onClick={onCancel}>
          Annuler
        </button>
        <button type="submit" className="primary">
          Continuer
        </button>
      </div>
    </form>
  );
}

export default EventDetailsStep;
