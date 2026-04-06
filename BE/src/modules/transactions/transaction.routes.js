"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const db_1 = require("../../database/db");
const authMiddleware_1 = require("../../middlewares/authMiddleware");
const authenticate_1 = require("../../middlewares/authenticate");
const router = (0, express_1.Router)();
async function getUserByEmail(email) {
    const result = await (0, db_1.query) `SELECT TOP 1 UserID, Email FROM Users WHERE Email = ${email}`;
    return result.recordset[0] || null;
}
router.get("/transactions", authenticate_1.authenticate, async (req, res) => {
    try {
        const email = String(req.query.email || req.header("x-user-email") || "").trim();
        if (!email) {
            return res.status(400).json({ error: "Missing email" });
        }
        const user = await getUserByEmail(email);
        if (!user) {
            return res.status(404).json({ error: "User not found" });
        }
        const result = await (0, db_1.query) `
            SELECT t.TransactionID, t.UserID, t.PackageID, t.Amount, t.PaymentMethod, t.TransactionCode, t.Status, t.PaidAt, t.CreatedAt,
                   vp.PackageName, vp.Duration, vp.Price
            FROM Transactions t
            LEFT JOIN VIPPackages vp ON vp.PackageID = t.PackageID
            WHERE t.UserID = ${user.UserID}
            ORDER BY t.CreatedAt DESC
        `;
        return res.json(result.recordset);
    }
    catch (error) {
        console.error("GET /transactions error:", error);
        return res.status(500).json({ error: "Failed to fetch transactions" });
    }
});
router.post("/transactions", authenticate_1.authenticate, async (req, res) => {
    try {
        const { email, packageId, amount, paymentMethod, transactionCode } = req.body || {};
        if (!email || !packageId || !amount) {
            return res.status(400).json({ error: "Missing email, packageId or amount" });
        }
        const user = await getUserByEmail(String(email).trim());
        if (!user) {
            return res.status(404).json({ error: "User not found" });
        }
        const transactionId = await (0, db_1.executeTransaction)(async (transaction) => {
            const request = transaction.request();
            request.input("userId", user.UserID);
            request.input("packageId", Number(packageId));
            request.input("amount", Number(amount));
            request.input("paymentMethod", paymentMethod || null);
            request.input("transactionCode", transactionCode || `TX-${Date.now()}`);
            const inserted = await request.query(`
                INSERT INTO Transactions (UserID, PackageID, Amount, PaymentMethod, TransactionCode, Status, CreatedAt)
                OUTPUT INSERTED.TransactionID
                VALUES (@userId, @packageId, @amount, @paymentMethod, @transactionCode, 'Pending', GETDATE())
            `);
            return inserted.recordset[0]?.TransactionID || null;
        });
        return res.status(201).json({ ok: true, transactionId });
    }
    catch (error) {
        console.error("POST /transactions error:", error);
        return res.status(500).json({ error: "Failed to create transaction" });
    }
});
router.put("/transactions/:id", authenticate_1.authenticate, authMiddleware_1.requireRoles(["Admin"]), async (req, res) => {
    try {
        const transactionId = Number(req.params.id);
        const { status, paidAt, paymentMethod } = req.body || {};
        if (!Number.isFinite(transactionId) || transactionId <= 0) {
            return res.status(400).json({ error: "Invalid transaction id" });
        }
        await (0, db_1.executeTransaction)(async (transaction) => {
            const request = transaction.request();
            request.input("transactionId", transactionId);
            request.input("status", status || "Pending");
            request.input("paymentMethod", paymentMethod || null);
            request.input("paidAt", paidAt || null);
            await request.query(`
                UPDATE Transactions
                SET Status = @status,
                    PaymentMethod = COALESCE(@paymentMethod, PaymentMethod),
                    PaidAt = CASE WHEN @paidAt IS NULL THEN PaidAt ELSE @paidAt END
                WHERE TransactionID = @transactionId
            `);
        });
        return res.json({ ok: true });
    }
    catch (error) {
        console.error("PUT /transactions/:id error:", error);
        return res.status(500).json({ error: "Failed to update transaction" });
    }
});
router.delete("/transactions/:id", authenticate_1.authenticate, authMiddleware_1.requireRoles(["Admin"]), async (req, res) => {
    try {
        const transactionId = Number(req.params.id);
        if (!Number.isFinite(transactionId) || transactionId <= 0) {
            return res.status(400).json({ error: "Invalid transaction id" });
        }
        await (0, db_1.query) `DELETE FROM Transactions WHERE TransactionID = ${transactionId}`;
        return res.json({ ok: true });
    }
    catch (error) {
        console.error("DELETE /transactions/:id error:", error);
        return res.status(500).json({ error: "Failed to delete transaction" });
    }
});
exports.default = router;
