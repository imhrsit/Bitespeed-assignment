import { Router, Request, Response } from "express";
import db from "../db/database";

interface Contact {
    id: number;
    phoneNumber: string | null;
    email: string | null;
    linkedId: number | null;
    linkPrecedence: "primary" | "secondary";
    createdAt: string;
    updatedAt: string;
    deletedAt: string | null;
}

const router = Router();

function findMatchingContacts(email?: string, phoneNumber?: string): Contact[] {
    const conditions: string[] = [];
    const params: string[] = [];

    if (email) {
        conditions.push("email = ?");
        params.push(email);
    }
    if (phoneNumber) {
        conditions.push("phoneNumber = ?");
        params.push(phoneNumber);
    }

    return db.prepare(
        `SELECT * FROM Contact WHERE deletedAt IS NULL AND (${conditions.join(" OR ")})`
    ).all(...params) as Contact[];
}

function getPrimaryContact(contact: Contact): Contact {
    if (contact.linkPrecedence === "primary") return contact;
    return db.prepare("SELECT * FROM Contact WHERE id = ?").get(contact.linkedId) as Contact;
}

function getUniqueRootPrimaries(contacts: Contact[]): Contact[] {
    const primaryMap = new Map<number, Contact>();
    for (const contact of contacts) {
        const primary = getPrimaryContact(contact);
        primaryMap.set(primary.id, primary);
    }
    return Array.from(primaryMap.values());
}

function mergePrimaries(primaries: Contact[]): Contact {
    primaries.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
    const oldest = primaries[0];
    const now = new Date().toISOString();

    for (let i = 1; i < primaries.length; i++) {
        const newer = primaries[i];

        db.prepare(
            `UPDATE Contact SET linkPrecedence = 'secondary', linkedId = ?, updatedAt = ? WHERE id = ?`
        ).run(oldest.id, now, newer.id);

        db.prepare(
            `UPDATE Contact SET linkedId = ?, updatedAt = ? WHERE linkedId = ?`
        ).run(oldest.id, now, newer.id);
    }

    return oldest;
}

function createContact(
    email: string | null,
    phoneNumber: string | null,
    linkPrecedence: "primary" | "secondary",
    linkedId: number | null
): number {
    const now = new Date().toISOString();
    const result = db.prepare(
        `INSERT INTO Contact (phoneNumber, email, linkedId, linkPrecedence, createdAt, updatedAt)
     VALUES (?, ?, ?, ?, ?, ?)`
    ).run(phoneNumber, email, linkedId, linkPrecedence, now, now);

    return Number(result.lastInsertRowid);
}

function getClusterContacts(primaryId: number): Contact[] {
    return db.prepare(
        `SELECT * FROM Contact WHERE deletedAt IS NULL AND (id = ? OR linkedId = ?) ORDER BY createdAt ASC`
    ).all(primaryId, primaryId) as Contact[];
}

function buildResponse(primaryId: number, cluster: Contact[]) {
    const primary = cluster.find(c => c.id === primaryId)!;
    const emails: string[] = [];
    const phoneNumbers: string[] = [];
    const secondaryContactIds: number[] = [];

    if (primary.email) emails.push(primary.email);
    if (primary.phoneNumber) phoneNumbers.push(primary.phoneNumber);

    for (const contact of cluster) {
        if (contact.id === primaryId) continue;
        secondaryContactIds.push(contact.id);
        if (contact.email && !emails.includes(contact.email)) emails.push(contact.email);
        if (contact.phoneNumber && !phoneNumbers.includes(contact.phoneNumber)) phoneNumbers.push(contact.phoneNumber);
    }

    return {
        contact: {
            primaryContatctId: primaryId,
            emails,
            phoneNumbers,
            secondaryContactIds,
        },
    };
}

router.post("/", (req: Request, res: Response) => {
    const { email, phoneNumber } = req.body as { email?: string; phoneNumber?: string };

    if (!email && !phoneNumber) {
        res.status(400).json({ error: "At least email or phoneNumber must be provided" });
        return;
    }

    const matchedContacts = findMatchingContacts(email, phoneNumber);

    if (matchedContacts.length === 0) {
        const newId = createContact(email || null, phoneNumber || null, "primary", null);
        res.status(200).json({
            contact: {
                primaryContatctId: newId,
                emails: email ? [email] : [],
                phoneNumbers: phoneNumber ? [phoneNumber] : [],
                secondaryContactIds: [],
            },
        });
        return;
    }

    const primaries = getUniqueRootPrimaries(matchedContacts);
    const finalPrimary = primaries.length > 1 ? mergePrimaries(primaries) : primaries[0];

    const currentCluster = getClusterContacts(finalPrimary.id);
    const existingEmails = new Set(currentCluster.map(c => c.email).filter(Boolean));
    const existingPhones = new Set(currentCluster.map(c => c.phoneNumber).filter(Boolean));

    const hasNewInfo =
        (email && !existingEmails.has(email)) || (phoneNumber && !existingPhones.has(phoneNumber));

    if (hasNewInfo) {
        createContact(email || null, phoneNumber || null, "secondary", finalPrimary.id);
    }

    const finalCluster = getClusterContacts(finalPrimary.id);
    res.status(200).json(buildResponse(finalPrimary.id, finalCluster));
});

export default router;
