import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import EventDetailsStep from './EventDetailsStep';

describe('EventDetailsStep', () => {
  it('met à jour l’interface avec les erreurs externes et les efface lors de la saisie', async () => {
    const user = userEvent.setup();
    render(
      <EventDetailsStep
        initialValues={{ title: '', deadline: '', budget: '', location: '' }}
        onSubmit={jest.fn()}
        externalErrors={{ title: 'Erreur de titre serveur' }}
      />
    );

    const titleInput = screen.getByLabelText(/Nom de l’évènement/i);
    expect(titleInput).toHaveClass('is-invalid');
    expect(screen.getByText(/Erreur de titre serveur/i)).toBeInTheDocument();

    await user.type(titleInput, 'Secret Santa 2024');
    expect(titleInput).not.toHaveClass('is-invalid');
  });
});
