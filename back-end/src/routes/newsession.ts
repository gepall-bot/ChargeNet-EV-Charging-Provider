import express, { Request, Response } from "express";
import prisma from "../prisma/client.ts";
import { makeErrorLog } from "../middleware/errorHandler.ts";
import { verifyToken } from "../middleware/verifyToken.ts";
import { ChargerStatus, ReservationStatus, SessionStatus } from "@prisma/client";
import { chargeSession } from "../controllers/paymentController.ts";

const router = express.Router();

const handleNewSession = async (req: Request, res: Response) => {
  try {
    // Input Fields
        const {
            pointid,
            starttime,
            endtime,
            startsoc,
            endsoc,
            totalkwh,
            kwhprice,
            amount,
        } = req.body;

    // 1. Έλεγχος πληρότητας πεδίων -> 400 Bad Request
    if (!pointid || !starttime || !endtime || !totalkwh || kwhprice === undefined || amount === undefined) {
        const err = makeErrorLog(req, 400, "Missing required fields");
        return res.status(400).json(err);
    }

    const userId = req.userId;
    if (!userId) {
        return res.status(401).json({ error: "Unauthorized" });
    }

    // 2. Έλεγχος ύπαρξης φορτιστή και έλεγχος κράτησης
    // Αν δεν υπάρχει, επιστρέφουμε 400
        const charger = await prisma.charger.findUnique({
            where: { id: Number(pointid) },
            include: {
                reservations: {
                    where: {
                        status: ReservationStatus.ACTIVE,
                        expiresAt: { gt: new Date() },
                    },
                },
            },
        });

        if (!charger) {
            return res.status(400).json(makeErrorLog(req, 400, "Invalid pointid: Charger not found"));
        }

        let reservationId: number | null = null;
        if (charger.status !== ChargerStatus.AVAILABLE) {
            const myReservation = charger.reservations.find((r) => r.userId === userId);

            if (myReservation) {
                reservationId = myReservation.id;
            } else {
                const msg =
                    charger.status === ChargerStatus.OUTAGE
                        ? "Charger is out of order"
                        : "Charger is currently in use or reserved by another user";

                return res.status(403).json(makeErrorLog(req, 403, msg));
            }
        }

    // 3. Έλεγχος ημερομηνιών -> 400 Bad Request
        const start = new Date(starttime);
        const end = new Date(endtime);
    
        if (isNaN(start.getTime()) || isNaN(end.getTime()) || end <= start) {
            const err = makeErrorLog(req, 400, "Invalid date range supplied");
            return res.status(400).json(err);
        }

        const totalKWh = Number(totalkwh);
        const pricePerKWh = Number(kwhprice);
        const amountNumber = Number(amount);
        const startSocNumber =
            startsoc === undefined || startsoc === null ? null : Number(startsoc);
        const endSocNumber = endsoc === undefined || endsoc === null ? null : Number(endsoc);

        if (!Number.isFinite(totalKWh) || totalKWh <= 0) {
            return res.status(400).json(makeErrorLog(req, 400, "Total kWh must be a positive number"));
        }

        if (!Number.isFinite(pricePerKWh) || pricePerKWh < 0) {
            return res.status(400).json(makeErrorLog(req, 400, "Price per kWh must be zero or positive"));
        }

        if (!Number.isFinite(amountNumber) || amountNumber <= 0) {
            return res.status(400).json(makeErrorLog(req, 400, "Amount must be a positive number"));
        }

        if (
            startSocNumber !== null &&
            (!Number.isFinite(startSocNumber) || startSocNumber < 0 || startSocNumber > 100)
        ) {
            return res
                .status(400)
                .json(makeErrorLog(req, 400, "Starting state of charge must be between 0 and 100"));
        }

        if (
            endSocNumber !== null &&
            (!Number.isFinite(endSocNumber) || endSocNumber < 0 || endSocNumber > 100)
        ) {
            return res
                .status(400)
                .json(makeErrorLog(req, 400, "Ending state of charge must be between 0 and 100"));
        }

        const session = await prisma.$transaction(async (tx) => {
            if (reservationId) {
                await tx.reservation.update({
                    where: { id: reservationId },
                    data: { status: ReservationStatus.EXPIRED },
                });
            }

            const createdSession = await tx.session.create({
                data: {
                    userId,
                    chargerId: Number(pointid),
                    reservationId,
                    startedAt: start,
                    endedAt: end,
                    kWh: totalKWh,
                    pricePerKWh,
                    costEur: amountNumber,
                    status: SessionStatus.COMPLETED,
                },
            });

            await tx.charger.update({
                where: { id: charger.id },
                data: { status: ChargerStatus.AVAILABLE },
            });

            return createdSession;
        });

        let paymentResult: unknown = null;
        let paymentError: string | null = null;

        try {
            paymentResult = await chargeSession(session.id, amountNumber, userId);
        } catch (err: any) {
            paymentError = err?.message ?? "Payment attempt failed";
        }

        const paymentIntentId =
            paymentResult && typeof paymentResult === "object"
                ? (paymentResult as { id?: string }).id ?? null
                : null;

        const paymentStatus =
            paymentResult && typeof paymentResult === "object"
                ? (paymentResult as { status?: string }).status ?? "captured"
                : null;

        return res.status(201).json({
            session: {
                id: session.id,
                chargerId: session.chargerId,
                reservationId,
                startedAt: session.startedAt.toISOString(),
                endedAt: session.endedAt?.toISOString() ?? null,
                kWh: Number(session.kWh),
                pricePerKWh,
                costEur: amountNumber,
            },
            payment: paymentResult
                ? {
                        id: paymentIntentId,
                        status: paymentStatus,
                        amountEur: amountNumber,
                    }
                : {
                        status: "failed",
                        error: paymentError,
                    },
            metrics: {
                startsoc: startSocNumber,
                endsoc: endSocNumber,
            },
        });

  } catch (err: any) {
    const errorLog = makeErrorLog(req, 500, "Internal server error", err.message);
    return res.status(500).json(errorLog);
  }
};

router.post("/", verifyToken, handleNewSession);

export default router;