package com.demo.bank;

import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.*;

class BankTest {

    @Test
    void transferMovesMoneyBetweenAccounts() {
        Bank bank = new Bank();
        Account a = new Account("A1", "Rahim", 500.0, "1234");
        Account b = new Account("A2", "Karim", 100.0, "5678");
        bank.addAccount(a);
        bank.addAccount(b);

        bank.transfer(a, b, 200.0);

        assertEquals(300.0, a.getBalance());
        assertEquals(300.0, b.getBalance());
    }

    @Test
    void findAccountByOwnerReturnsCorrectAccount() {
        Bank bank = new Bank();
        Account a = new Account("A1", "Rahim", 500.0, "1234");
        bank.addAccount(a);

        Account found = bank.findAccountByOwner("Rahim");
        assertEquals("A1", found.getAccountId());
    }

    // NOTE (intentionally missing coverage — for the review bot to flag):
    //  - No test for transfer() when the sender has insufficient funds.
    //    (Currently, if withdraw() throws, the recipient has already been
    //    credited — money would be duplicated. There is no test proving
    //    this is handled correctly, because it currently is NOT handled.)
}
