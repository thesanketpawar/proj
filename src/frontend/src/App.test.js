import { render, screen } from '@testing-library/react';
import App from './App';

jest.mock('axios', () => ({
  get: jest.fn().mockResolvedValue({ data: [] }),
  post: jest.fn(),
  delete: jest.fn()
}));

test('renders main heading', () => {
  render(<App />);
  const heading = screen.getByText(/Three-Tier DevOps Project/i);
  expect(heading).toBeInTheDocument();
});
