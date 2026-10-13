import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { OfflineBanner } from './OfflineBanner';

const defaultProps = { isOnline: true, isSyncing: false, syncError: null, isIos: false };

describe('OfflineBanner', () => {
  it('não renderiza quando online, sem sync e sem erro', () => {
    const { container } = render(<OfflineBanner {...defaultProps} />);
    expect(container.firstChild).toBeNull();
  });

  it('exibe mensagem offline iOS quando iOS e sem rede', () => {
    render(<OfflineBanner {...defaultProps} isOnline={false} isIos={true} />);
    expect(screen.getByText(/Acesso offline não disponível no iOS/)).toBeInTheDocument();
  });

  it('exibe mensagem offline normal quando sem rede (não iOS)', () => {
    render(<OfflineBanner {...defaultProps} isOnline={false} isIos={false} />);
    expect(screen.getByText(/Você está offline/)).toBeInTheDocument();
    expect(screen.getByText(/Exibindo dados armazenados localmente/)).toBeInTheDocument();
  });

  it('exibe mensagem sincronizando quando online e isSyncing', () => {
    render(<OfflineBanner {...defaultProps} isSyncing={true} />);
    expect(screen.getByText(/Conexão restaurada. Atualizando dados/)).toBeInTheDocument();
  });

  it('exibe mensagem de erro quando syncError', () => {
    render(<OfflineBanner {...defaultProps} syncError="algum erro" />);
    expect(screen.getByText(/Erro ao sincronizar/)).toBeInTheDocument();
  });

  it('iOS offline tem prioridade sobre offline normal', () => {
    render(<OfflineBanner {...defaultProps} isOnline={false} isIos={true} />);
    expect(screen.queryByText(/Você está offline\./)).not.toBeInTheDocument();
    expect(screen.getByText(/Acesso offline não disponível no iOS/)).toBeInTheDocument();
  });
});
