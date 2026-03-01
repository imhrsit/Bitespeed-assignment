import express from "express";
import identifyRouter from "./routes/identify";

const app = express();

app.use(express.json());

app.post("/identify", identifyRouter);

export default app;
