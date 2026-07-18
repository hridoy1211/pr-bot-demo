package com.demo.bank;

import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.*;

class AccountTest {

    @Test
    void depositIncreasesBalance() {
        Account acc = new Account("A1", "Rahim", 500.0, "1234");
        acc.deposit(200.0);
        assertEquals(700.0, acc.getBalance());
    }

    @Test
    void withdrawDecreasesBalance() {
        Account acc = new Account("A1", "Rahim", 500.0, "1234");
        acc.withdraw(200.0);
        assertEquals(300.0, acc.getBalance());
    }

    @Test
    void withdrawMoreThanBalanceThrows() {
        Account acc = new Account("A1", "Rahim", 500.0, "1234");
        assertThrows(IllegalStateException.class, () -> acc.withdraw(600.0));
    }

    @Test
    void correctPinReturnsTrueForLiteralPin() {
        // Note: this test uses a PIN written as the same string literal,
        // which happens to pass due to Java string interning. It does not
        // catch how checkPin() actually compares strings.
        Account acc = new Account("A1", "Rahim", 500.0, "1234");
        assertTrue(acc.checkPin("1234"));
    }

    // NOTE (intentionally missing coverage — for the review bot to flag):
    //  - No test for deposit() with a negative amount
    //  - No test for withdraw() with a negative amount
    //  - No test for checkPin() with a PIN string built at runtime
    //    (e.g. via a StringBuilder), which would expose the == bug
}
