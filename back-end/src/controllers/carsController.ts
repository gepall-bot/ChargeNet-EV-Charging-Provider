// back-end/src/controllers/cars.controller.ts
import { Request, Response } from 'express'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

export async function getBrands(req: Request, res: Response) {
  try {
    const rows = await prisma.car.findMany({
      select: { brand: true },
      distinct: ['brand'],
      orderBy: { brand: 'asc' },
    })
    res.json(rows.map((r) => r.brand))
  } catch (err) {
    console.error('Error fetching brands:', err)
    res.status(500).json({ error: 'Internal Server Error' })
  }
}

export async function getModelsByBrand(req: Request, res: Response) {
  try {
    const brand = (req.query.brand as string)?.trim()
    if (!brand) {
      return res.status(400).json({ error: 'Query parameter "brand" is required' })
    }

    const rows = await prisma.car.findMany({
      where: { brand: { equals: brand, mode: 'insensitive' } },
      select: { model: true },
      distinct: ['model'],
      orderBy: { model: 'asc' },
    })
    res.json(rows.map((r) => r.model))
  } catch (err) {
    console.error('Error fetching models:', err)
    res.status(500).json({ error: 'Internal Server Error' })
  }
}

export async function searchCars(req: Request, res: Response) {
  try {
    const q = (req.query.q as string)?.trim()

    if (!q) {
      return res.status(400).json({ error: 'Query parameter "q" is required' })
    }

    // Case-insensitive search by brand OR model
    const cars = await prisma.car.findMany({
      where: {
        OR: [
          { brand: { contains: q, mode: 'insensitive' } },
          { model: { contains: q, mode: 'insensitive' } },
        ],
      },
      select: {
        id: true,
        brand: true,
        model: true,
        variant: true,
        usableBatteryKWh: true,
        acMaxKW: true,
        dcMaxKW: true,
        dcPorts: true,
        acPorts: true,
      },
      take: 25, // limit results for UI
      orderBy: [
        { brand: 'asc' },
        { model: 'asc' },
      ],
    })

    res.json(cars)
  } catch (err) {
    console.error('Error searching cars:', err)
    res.status(500).json({ error: 'Internal Server Error' })
  }
}