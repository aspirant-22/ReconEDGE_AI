import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import FinanceQA from '../FinanceQA';

vi.mock('../../services/api', () => ({
  default: {
    get: vi.fn(),
    post: vi.fn(),
  },
}));

import api from '../../services/api';

const statusResponse = { data: { success: true, available: true, model: 'gemini' } };

const qaSuccessResponse = {
  data: {
    success: true,
    data: {
      question: 'What is the match rate?',
      intent: 'RECONCILIATION',
      answer: 'The payment match rate is 70%.',
      keyMetrics: [{ label: 'Payment Match Rate', value: '70%' }],
      insights: ['Match rate is acceptable.'],
      dataSources: ['reconciliation-analytics'],
      confidence: 0.9,
      requiresHumanReview: false,
    },
  },
};

describe('FinanceQA Page', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    api.get.mockResolvedValue(statusResponse);
  });

  it('renders the page header', () => {
    render(<FinanceQA />);
    expect(screen.getByRole('heading', { name: /Finance Q&A/ })).toBeInTheDocument();
    expect(screen.getByText(/Ask natural-language questions/)).toBeInTheDocument();
  });

  it('renders advisory banner', () => {
    render(<FinanceQA />);
    expect(screen.getByText(/AI Finance Copilot/)).toBeInTheDocument();
  });

  it('renders suggested questions', async () => {
    render(<FinanceQA />);
    expect(screen.getByText('What is the overall reconciliation status?')).toBeInTheDocument();
    expect(screen.getByText('How many exceptions are there and why?')).toBeInTheDocument();
  });

  it('submits a question and displays the answer', async () => {
    api.post.mockResolvedValue(qaSuccessResponse);
    render(<FinanceQA />);

    fireEvent.change(screen.getByPlaceholderText(/Ask about your reconciliation data/), {
      target: { value: 'What is the match rate?' },
    });
    fireEvent.click(screen.getByRole('button', { name: /Ask/ }));

    await waitFor(() => {
      expect(api.post).toHaveBeenCalledWith('/ai/finance-qa', { question: 'What is the match rate?' });
    });

    await waitFor(() => {
      expect(screen.getByText('The payment match rate is 70%.')).toBeInTheDocument();
      expect(screen.getByText('Payment Match Rate')).toBeInTheDocument();
      expect(screen.getByText('70%')).toBeInTheDocument();
    });
  });

  it('displays loading indicator while awaiting response', async () => {
    let resolvePost;
    api.post.mockReturnValue(new Promise((resolve) => { resolvePost = resolve; }));
    render(<FinanceQA />);

    fireEvent.change(screen.getByPlaceholderText(/Ask about your reconciliation data/), {
      target: { value: 'What is the match rate?' },
    });
    fireEvent.click(screen.getByRole('button', { name: /Ask/ }));

    await waitFor(() => {
      expect(screen.getByText('Analyzing...')).toBeInTheDocument();
    });

    resolvePost(qaSuccessResponse);
    await waitFor(() => {
      expect(screen.queryByText('Analyzing...')).not.toBeInTheDocument();
    });
  });

  it('displays an error message when the API call fails', async () => {
    api.post.mockRejectedValue({
      response: { data: { error: { message: 'AI analysis is temporarily unavailable.' } } },
    });
    render(<FinanceQA />);

    fireEvent.change(screen.getByPlaceholderText(/Ask about your reconciliation data/), {
      target: { value: 'What is the match rate?' },
    });
    fireEvent.click(screen.getByRole('button', { name: /Ask/ }));

    await waitFor(() => {
      expect(screen.getByText('AI analysis is temporarily unavailable.')).toBeInTheDocument();
    });
  });

  it('does not submit an empty question', async () => {
    render(<FinanceQA />);
    const askBtn = screen.getByRole('button', { name: /Ask/ });
    expect(askBtn).toBeDisabled();

    fireEvent.change(screen.getByPlaceholderText(/Ask about your reconciliation data/), {
      target: { value: '   ' },
    });
    expect(askBtn).toBeDisabled();
    expect(api.post).not.toHaveBeenCalled();
  });

  it('uses suggested question via click', async () => {
    api.post.mockResolvedValue(qaSuccessResponse);
    render(<FinanceQA />);

    fireEvent.click(screen.getByText('What is the overall reconciliation status?'));

    await waitFor(() => {
      expect(api.post).toHaveBeenCalledWith('/ai/finance-qa', { question: 'What is the overall reconciliation status?' });
    });

    await waitFor(() => {
      expect(screen.getByText('The payment match rate is 70%.')).toBeInTheDocument();
    });
  });
});
