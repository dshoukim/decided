import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/db'
import { streamingServices } from '@/db/schema'
import { eq } from 'drizzle-orm'

export async function GET(request: NextRequest) {
  try {
    // Fetch all active streaming services
    const services = await db
      .select()
      .from(streamingServices)
      .where(eq(streamingServices.isActive, true))
      .orderBy(streamingServices.name)

    // Format the service data for the frontend
    const servicesWithFormattedPrice = services.map(service => ({
      ...service,
      monthly_price: service.monthlyPrice || 0,
      logo_url: service.logoUrl,
      website_url: service.websiteUrl,
    }))

    return NextResponse.json(servicesWithFormattedPrice)

  } catch (error: any) {
    console.error('Error fetching streaming services:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
} 