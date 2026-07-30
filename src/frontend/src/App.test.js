import { render, screen } from '@testing-library/react';
import App from './App';

jest.mock('axios', () => ({
  get: jest.fn().mockResolvedValue({
    data: []
  }),
  post: jest.fn(),
  delete: jest.fn()
}));

test('renders main heading', async () => {

  render(<App />);

  const heading = await screen.findByText(
    /Three-Tier DevOps Project/i
  );

  expect(heading).toBeInTheDocument();

});
