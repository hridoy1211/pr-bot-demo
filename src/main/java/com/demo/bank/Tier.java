package com.demo.bank;

/**
 * Balance tiers used by {@link Bank#totalBalanceForTier}.
 *
 * <p>Each tier is defined as a half-open-then-closed range
 * {@code lowerExclusive < balance <= upperInclusive}. These thresholds encode
 * the exact boundaries the three former {@code totalBalanceFor*Tier} methods
 * used, so behavior is unchanged by the refactor:
 * <ul>
 *   <li>{@code BRONZE}: balance &lt;= 1000</li>
 *   <li>{@code SILVER}: 1000 &lt; balance &lt;= 10000</li>
 *   <li>{@code GOLD}:   balance &gt; 10000</li>
 * </ul>
 */
public enum Tier {

    BRONZE(Double.NEGATIVE_INFINITY, 1000),
    SILVER(1000, 10000),
    GOLD(10000, Double.POSITIVE_INFINITY);

    private final double lowerExclusive;
    private final double upperInclusive;

    Tier(double lowerExclusive, double upperInclusive) {
        this.lowerExclusive = lowerExclusive;
        this.upperInclusive = upperInclusive;
    }

    /**
     * @return true if {@code balance} falls in this tier, i.e.
     *         {@code lowerExclusive < balance <= upperInclusive}.
     */
    public boolean contains(double balance) {
        return balance > lowerExclusive && balance <= upperInclusive;
    }
}
