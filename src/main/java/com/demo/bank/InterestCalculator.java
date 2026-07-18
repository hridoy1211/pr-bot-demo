package com.demo.bank;

/**
 * Calculates annual interest based on account balance tiers.
 *
 * Tiers:
 *   balance <= 1000            -> 1% interest
 *   1000 < balance <= 10000    -> 2% interest
 *   balance > 10000            -> 3% interest
 */
public class InterestCalculator {

    private static final double BRONZE_RATE = 0.01;
    private static final double SILVER_RATE = 0.02;
    private static final double GOLD_RATE = 0.03;

    public double calculateInterest(double balance) {
        if (balance > 1000 && balance < 10000) {
            return balance * SILVER_RATE;
        } else if (balance >= 10000) {
            return balance * GOLD_RATE;
        } else {
            return balance * BRONZE_RATE;
        }
    }
}
