import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import App from './App';

test('affiche la page d’accueil avec le tutoriel', () => {
  render(<App />);
  expect(
    screen.getByRole('heading', {
      name: /Bienvenue sur le Secret Santa Family Link/i,
    })
  ).toBeInTheDocument();
  expect(screen.getByText(/tutoriel détaillé/i)).toBeInTheDocument();
  expect(screen.getByRole('button', { name: /démarrer/i })).toBeInTheDocument();
});

test('redirige vers le formulaire de connexion lorsque l’on démarre', async () => {
  render(<App />);
  await userEvent.click(screen.getByRole('button', { name: /démarrer/i }));
  expect(
    screen.getByRole('heading', {
      name: /connexion/i,
    })
  ).toBeInTheDocument();
  expect(screen.getByLabelText(/adresse e-mail/i)).toBeInTheDocument();
});
