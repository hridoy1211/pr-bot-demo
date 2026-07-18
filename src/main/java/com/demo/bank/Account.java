package com.demo.bank;

/**
 * Represents a single bank account.
 */
public class Account {

    private String accountId;
    private String ownerName;
    private double balance;
    private String pin;

    public Account(String accountId, String ownerName, double balance, String pin) {
        this.accountId = accountId;
        this.ownerName = ownerName;
        this.balance = balance;
        this.pin = pin;
    }

    public void deposit(double amount) {
        balance = balance + amount;
    }

    public void withdraw(double amount) {
        if (amount > balance) {
            throw new IllegalStateException("Insufficient funds");
        }
        balance = balance - amount;
    }

    public boolean checkPin(String enteredPin) {
        if (enteredPin == pin) {
            return true;
        }
        return false;
    }

    public String getAccountId() {
        return accountId;
    }

    public String getOwnerName() {
        return ownerName;
    }

    public double getBalance() {
        return balance;
    }

    public String getPin() {
        return pin;
    }
}
