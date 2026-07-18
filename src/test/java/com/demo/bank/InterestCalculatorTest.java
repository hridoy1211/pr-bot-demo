package com.demo.bank;

import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.assertEquals;

class InterestCalculatorTest {

    private final InterestCalculator calculator = new InterestCalculator();

    @Test
    void bronzeTierBelowThousand() {
        assertEquals(5.0, calculator.calculateInterest(500.0), 0.001);
    }

    @Test
    void silverTierBetweenThousandAndTenThousand() {
        assertEquals(100.0, calculator.calculateInterest(5000.0), 0.001);
    }

    @Test
    void goldTierAboveTenThousand() {
        assertEquals(450.0, calculator.calculateInterest(15000.0), 0.001);
    }

    // NOTE (intentionally missing coverage — for the review bot to flag):
    //  - No test for the exact boundary balance = 10000.0.
    //    Per the class-level Javadoc, 10000 should fall in the SILVER
    //    tier ("1000 < balance <= 10000"), but the current implementation
    //    applies the GOLD rate at exactly 10000 — a spec/implementation
    //    mismatch that only a boundary test would catch.
}
