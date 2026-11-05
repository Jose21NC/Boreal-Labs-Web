// Saldo de la Wallet de una persona (por correo). Sin doc de la Wallet, muestra lo pendiente atenuado.
import React from 'react';

export default function PointsCell({ person, loading }) {
  if (loading) return <span className="text-adm-muted">…</span>;
  if (!person) return <span className="text-adm-muted">0</span>;
  if (person.walletBalance == null) {
    return <span className="tabular-nums text-adm-warning" title="Sin cuenta Wallet: no verá estos puntos hasta iniciar sesión.">{person.balance}*</span>;
  }
  const extra = person.balance - person.walletBalance;
  return (
    <span className="font-semibold tabular-nums" title={extra ? `${extra} pts más en registros duplicados` : 'Saldo en la Wallet'}>
      {person.walletBalance}{extra ? <span className="font-normal text-adm-warning">+{extra}</span> : null}
    </span>
  );
}
