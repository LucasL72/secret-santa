import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import ParticipantsStep from './ParticipantsStep';

describe('ParticipantsStep', () => {
  const defaultProps = {
    participants: [],
    onUpdate: jest.fn(),
    onNext: jest.fn(),
    onBack: jest.fn(),
    onCancel: jest.fn(),
  };

  it('affiche les erreurs externes et nettoie les erreurs de champ lors de la saisie', async () => {
    const user = userEvent.setup();
    render(
      <ParticipantsStep
        {...defaultProps}
        externalErrors={{
          global: 'Erreur globale serveur',
          fieldErrors: { email: 'Adresse e-mail incorrecte.' },
        }}
      />
    );

    const alert = screen.getByRole('alert');
    expect(alert).toHaveTextContent('Erreur globale serveur');

    const emailInput = screen.getByLabelText(/Adresse e-mail/i);
    expect(emailInput).toHaveClass('is-invalid');

    await user.type(emailInput, 'alice@example.com');
    expect(emailInput).not.toHaveClass('is-invalid');
  });
});
