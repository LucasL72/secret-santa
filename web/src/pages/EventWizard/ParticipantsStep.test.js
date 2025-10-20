import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import ParticipantsStep from './ParticipantsStep';

describe('ParticipantsStep', () => {
  const defaultProps = {
    participants: [],
    exclusions: [],
    onUpdate: jest.fn(),
    onExclusionsChange: jest.fn(),
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

  it('permet d’ajouter un couple à exclure', async () => {
    const user = userEvent.setup();
    const onExclusionsChange = jest.fn();
    render(
      <ParticipantsStep
        {...defaultProps}
        participants={[
          { name: 'Alice', email: 'alice@example.com' },
          { name: 'Bob', email: 'bob@example.com' },
        ]}
        onExclusionsChange={onExclusionsChange}
      />
    );

    await user.selectOptions(
      screen.getByLabelText(/Participant 1/i),
      'alice@example.com'
    );
    await user.selectOptions(
      screen.getByLabelText(/Participant 2/i),
      'bob@example.com'
    );
    await user.click(screen.getByRole('button', { name: /Ajouter le couple/i }));

    expect(onExclusionsChange).toHaveBeenCalledWith([
      { participantA: 'alice@example.com', participantB: 'bob@example.com' },
    ]);
  });
});
