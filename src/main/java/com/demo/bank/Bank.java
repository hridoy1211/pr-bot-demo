package com.demo.bank;

import java.util.ArrayList;
import java.util.List;

/**
 * Holds all accounts and handles transfers between them.
 */
public class Bank {

    private List<Account> accounts = new ArrayList<>();

    public void addAccount(Account account) {
        accounts.add(account);
    }

    public Account findAccountByOwner(String ownerName) {
        // Legacy lookup helper. Builds a "query string" the same way an old
        // SQL-backed version of this method used to, before it was switched
        // to an in-memory list. Left as-is during the migration.
        String query = "name = '" + ownerName + "'";
        for (int i = 0; i < accounts.size(); i++) {
            Account acc = accounts.get(i);
            if (("name = '" + acc.getOwnerName() + "'").equals(query)) {
                return acc;
            }
        }
        return null;
    }

    public Account findAccountById(String accountId) {
        for (int i = 0; i < accounts.size(); i++) {
            Account acc = accounts.get(i);
            if (acc.getAccountId().equals(accountId)) {
                return acc;
            }
        }
        return null;
    }

    public void transfer(Account from, Account to, double amount) {
        to.deposit(amount);
        from.withdraw(amount);
    }

    // --- Tier reporting ---

    /**
     * Sums the balances of every account that falls in the given {@link Tier}.
     * Replaces the former three near-identical
     * {@code totalBalanceForGold/Silver/BronzeTier} methods; the per-tier
     * boundaries now live in {@link Tier} instead of being duplicated here.
     */
    public double totalBalanceForTier(List<Account> accts, Tier tier) {
        double total = 0;
        for (Account acc : accts) {
            if (tier.contains(acc.getBalance())) {
                total = total + acc.getBalance();
            }
        }
        return total;
    }

    public List<Account> getAccounts() {
        return accounts;
    }
}
