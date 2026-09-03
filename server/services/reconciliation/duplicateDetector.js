function detectDuplicateBankTransactions(bankTransactions, paymentToBankCandidates) {
  const duplicateGroups = [];
  const processed = new Set();

  const refGroups = new Map();
  for (const bankTx of bankTransactions) {
    if (!bankTx.referenceId) continue;
    if (!refGroups.has(bankTx.referenceId)) {
      refGroups.set(bankTx.referenceId, []);
    }
    refGroups.get(bankTx.referenceId).push(bankTx);
  }

  for (const [referenceId, group] of refGroups) {
    if (group.length > 1) {
      const sorted = group.sort((a, b) => {
        const dateA = new Date(a.transactionDate).getTime();
        const dateB = new Date(b.transactionDate).getTime();
        if (dateA !== dateB) return dateA - dateB;
        return a.bankTransactionId.localeCompare(b.bankTransactionId);
      });

      duplicateGroups.push({
        referenceId,
        legitimate: sorted[0].bankTransactionId,
        duplicates: sorted.slice(1).map((b) => b.bankTransactionId),
        allBankIds: sorted.map((b) => b.bankTransactionId),
      });

      for (const b of sorted) {
        processed.add(b.bankTransactionId);
      }
    }
  }

  return { duplicateGroups, processed };
}

function selectBestDuplicate(duplicateGroup, payment, bankMap) {
  const candidates = duplicateGroup.allBankIds.map((id) => bankMap.get(id)).filter(Boolean);

  let bestMatch = null;
  let bestScore = -1;

  for (const candidate of candidates) {
    let score = 0;

    const amountDiff = Math.abs(payment.amountPaise - candidate.amountPaise);
    if (amountDiff === 0) score += 10;
    else if (amountDiff < 100) score += 5;

    const dateDiff = Math.abs(
      (new Date(payment.paymentDate).getTime() - new Date(candidate.transactionDate).getTime()) /
        (1000 * 60 * 60 * 24)
    );
    if (dateDiff <= 1) score += 5;
    else if (dateDiff <= 3) score += 3;
    else if (dateDiff <= 7) score += 1;

    if (candidate.description.includes(payment.orderId)) score += 3;

    if (score > bestScore) {
      bestScore = score;
      bestMatch = candidate;
    }
  }

  return bestMatch;
}

module.exports = { detectDuplicateBankTransactions, selectBestDuplicate };
