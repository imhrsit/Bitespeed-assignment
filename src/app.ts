import express from "express";
import identifyRouter from "./routes/identify";

const app = express();

app.use(express.json());

app.get("/", (_req, res) => {
    res.status(200).json({ message: "Bitespeed Identity Reconciliation API" });
});

app.get("/health", (_req, res) => {
    res.status(200).json({ status: "ok" });
});

app.use("/identify", identifyRouter);

export default app;
