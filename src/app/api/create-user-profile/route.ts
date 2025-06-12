import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/db'
import { users } from '@/db/schema'
import { eq } from 'drizzle-orm'

export async function POST(request: NextRequest) {
  try {
    const profileData = await request.json()

    if (!profileData.id || !profileData.email || !profileData.name || !profileData.username) {
      return NextResponse.json(
        { error: 'Missing required fields: id, email, name, username' },
        { status: 400 }
      )
    }

    // Check if user already exists
    const existingUser = await db
      .select()
      .from(users)
      .where(eq(users.id, profileData.id))
      .limit(1)

    if (existingUser.length > 0) {
      return NextResponse.json(
        { error: 'User profile already exists' },
        { status: 409 }
      )
    }

    // Generate default avatar URL if none provided (for email/password users)
    const defaultAvatarUrl = `https://ui-avatars.com/api/?name=${encodeURIComponent(profileData.name)}&background=3b82f6&color=ffffff&size=200`;
    
    // Create the user profile
    const result = await db
      .insert(users)
      .values({
        id: profileData.id,
        email: profileData.email,
        name: profileData.name,
        username: profileData.username,
        dateOfBirth: profileData.dateOfBirth || null,
        gender: profileData.gender || null,
        avatarUrl: profileData.avatarUrl || defaultAvatarUrl,
        streamingServices: [],
        selectedGenres: [],
        selectedCharacteristics: []
      })
      .returning()

    return NextResponse.json({ 
      success: true, 
      data: result[0],
      message: 'User profile created successfully'
    })

  } catch (error: any) {
    console.error('Error creating user profile:', error)
    
    // Handle unique constraint violations
    if (error.code === '23505') {
      if (error.constraint?.includes('username')) {
        return NextResponse.json(
          { error: 'Username already taken. Please choose a different one.' },
          { status: 409 }
        )
      } else if (error.constraint?.includes('email')) {
        return NextResponse.json(
          { error: 'Email already registered. Please sign in instead.' },
          { status: 409 }
        )
      } else {
        return NextResponse.json(
          { error: 'User profile already exists' },
          { status: 409 }
        )
      }
    }
    
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
} 