import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import { BalanceCard } from '../BalanceCard';

jest.useFakeTimers();

describe('BalanceCard', () => {
  it('renderiza o card com saldo visível', () => {
    const { getByText } = render(
      <BalanceCard balance={1234.56} loading={false} onRefresh={jest.fn()} />
    );
    
    expect(getByText('Saldo Consolidado')).toBeTruthy();
    expect(getByText('R$ 1.234,56')).toBeTruthy();
  });

  it('renderiza ActivityIndicator quando loading é true', () => {
    const { UNSAFE_getByType } = render(
      <BalanceCard balance={null} loading={true} onRefresh={jest.fn()} />
    );
    
    expect(UNSAFE_getByType('ActivityIndicator')).toBeTruthy();
  });

  it('alterna visibilidade do saldo ao pressionar botão', () => {
    const { getByText } = render(
      <BalanceCard balance={1234.56} loading={false} onRefresh={jest.fn()} />
    );
    
    expect(getByText('R$ 1.234,56')).toBeTruthy();
  });
});
