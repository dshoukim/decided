'use client'

export const dynamic = 'force-dynamic';

import { useState, useEffect, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import QRCode from 'qrcode'
import { useAuth } from '@/components/providers/auth-provider'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { useToast } from '@/components/ui/use-toast'
import { Loader2, QrCode, Share2, Users, Film, X } from 'lucide-react'

function DecideTogetherPageInner() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { user, isLoading: userLoading } = useAuth()
  const { toast } = useToast()
  const [roomCode, setRoomCode] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [showQRModal, setShowQRModal] = useState(false)
  const [qrCodeUrl, setQrCodeUrl] = useState('')
  const [createdRoomCode, setCreatedRoomCode] = useState('')

  // Check for join parameter in URL
  useEffect(() => {
    const joinCode = searchParams.get('join')
    if (joinCode && user) {
      setRoomCode(joinCode.toUpperCase())
      // Auto-submit the form
      handleJoinRoom(null, joinCode)
    }
  }, [searchParams, user])

  const generateQRCode = async (code: string) => {
    const shareUrl = `${window.location.origin}/decide-together?join=${code}`
    try {
      const qr = await QRCode.toDataURL(shareUrl, {
        width: 200,
        margin: 2,
        color: {
          dark: '#000000',
          light: '#FFFFFF',
        },
      })
      setQrCodeUrl(qr)
      setShowQRModal(true)
    } catch (error) {
      console.error('Error generating QR code:', error)
    }
  }

  const handleCreateRoom = async () => {
    // Try to get userId from localStorage if not in user object
    const userId = user?.id || localStorage.getItem('userId')
    
    if (!userId) {
      toast({ 
        title: 'Sign in required', 
        description: 'Please sign in to create a room.',
        variant: 'destructive' 
      })
      router.push('/auth/signin?redirect=/decide-together')
      return
    }
    
    setIsLoading(true)
    try {
      const res = await fetch('/api/rooms', { 
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ userId })
      })
      const data = await res.json()
      
      if (data.success) {
        setCreatedRoomCode(data.room.code)
        toast({ 
          title: '🎉 Room created!', 
          description: `Share code: ${data.room.code}` 
        })
        
        // Generate QR code
        await generateQRCode(data.room.code)
        
        // Navigate to room
        setTimeout(() => {
          router.push(`/decide-together/${data.room.code}`)
        }, 1000)
      } else {
        toast({ 
          title: 'Error creating room', 
          description: data.error || 'Please try again',
          variant: 'destructive' 
        })
      }
    } catch (error) {
      toast({ 
        title: 'Connection error', 
        description: 'Unable to create room. Please check your connection.',
        variant: 'destructive' 
      })
    } finally {
      setIsLoading(false)
    }
  }

  const handleJoinRoom = async (e: React.FormEvent | null, codeOverride?: string) => {
    if (e) e.preventDefault()
    
    const codeToUse = codeOverride || roomCode
    
    // Try to get userId from localStorage if not in user object
    const userId = user?.id || localStorage.getItem('userId')
    
    if (!userId) {
      toast({ 
        title: 'Sign in required', 
        description: 'Please sign in to join a room.',
        variant: 'destructive' 
      })
      router.push(`/auth/signin?redirect=/decide-together?join=${codeToUse}`)
      return
    }
    
    if (!codeToUse) {
      toast({ 
        title: 'Code required', 
        description: 'Please enter a room code.',
        variant: 'destructive' 
      })
      return
    }
    
    setIsLoading(true)
    try {
      const res = await fetch(`/api/rooms/${codeToUse}/join`, { 
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ userId })
      })
      
      if (res.ok) {
        toast({ 
          title: '✅ Joined room!', 
          description: 'Connecting to your partner...' 
        })
        router.push(`/decide-together/${codeToUse}`)
      } else {
        const data = await res.json()
        toast({ 
          title: 'Unable to join room', 
          description: data.error || 'Room may be full or invalid',
          variant: 'destructive' 
        })
      }
    } catch (error) {
      toast({ 
        title: 'Connection error', 
        description: 'Unable to join room. Please check your connection.',
        variant: 'destructive' 
      })
    } finally {
      setIsLoading(false)
    }
  }

  const handleShare = async () => {
    const shareUrl = `${window.location.origin}/decide-together?join=${createdRoomCode}`
    
    if (navigator.share) {
      try {
        await navigator.share({
          title: 'Join my movie tournament!',
          text: `Let's decide what to watch together. Room code: ${createdRoomCode}`,
          url: shareUrl,
        })
      } catch (error) {
        // User cancelled share
      }
    } else {
      // Fallback to copying to clipboard
      navigator.clipboard.writeText(shareUrl)
      toast({ 
        title: 'Link copied!', 
        description: 'Share link copied to clipboard' 
      })
    }
  }

  if (userLoading) {
    return (
      <div className="container mx-auto max-w-2xl py-12 flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    )
  }

  return (
    <div className="container mx-auto max-w-2xl py-8 px-4">
      <div className="text-center mb-8">
        <h1 className="text-4xl font-bold mb-2 bg-gradient-to-r from-purple-600 to-pink-600 bg-clip-text text-transparent">
          Decided
        </h1>
        <p className="text-lg text-gray-600 dark:text-gray-400">
          End the "what should we watch?" debate once and for all
        </p>
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        {/* Create Room Card */}
        <Card className="hover:shadow-lg transition-shadow">
          <CardHeader>
            <div className="flex items-center gap-2">
              <div className="p-2 bg-purple-100 dark:bg-purple-900 rounded-lg">
                <Users className="h-5 w-5 text-purple-600 dark:text-purple-400" />
              </div>
              <CardTitle>Create a Room</CardTitle>
            </div>
            <CardDescription>
              Start a new tournament and invite a friend
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="text-sm text-gray-600 dark:text-gray-400 space-y-2">
              <p>• Tournament with movies from both watchlists</p>
              <p>• Real-time collaborative selection</p>
              <p>• Find the perfect movie in minutes</p>
            </div>
            <Button 
              onClick={handleCreateRoom} 
              disabled={isLoading || (!user && !localStorage.getItem('userId'))}
              className="w-full bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700"
            >
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Creating...
                </>
              ) : (
                <>
                  <Film className="mr-2 h-4 w-4" />
                  Create Room
                </>
              )}
            </Button>
            {!user && !localStorage.getItem('userId') && (
              <p className="text-xs text-center text-gray-500">
                Sign in required to create rooms
              </p>
            )}
          </CardContent>
        </Card>

        {/* Join Room Card */}
        <Card className="hover:shadow-lg transition-shadow">
          <CardHeader>
            <div className="flex items-center gap-2">
              <div className="p-2 bg-blue-100 dark:bg-blue-900 rounded-lg">
                <QrCode className="h-5 w-5 text-blue-600 dark:text-blue-400" />
              </div>
              <CardTitle>Join a Room</CardTitle>
            </div>
            <CardDescription>
              Enter a code to join your friend's tournament
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <form onSubmit={handleJoinRoom} className="space-y-4">
              <div>
                <Input
                  value={roomCode}
                  onChange={(e) => setRoomCode(e.target.value.toUpperCase().slice(0, 6))}
                  placeholder="ENTER CODE"
                  maxLength={6}
                  className="text-center text-2xl font-mono tracking-wider"
                  disabled={isLoading || (!user && !localStorage.getItem('userId'))}
                />
                <p className="text-xs text-gray-500 mt-1 text-center">
                  6-character room code
                </p>
              </div>
              <Button 
                type="submit" 
                disabled={isLoading || !roomCode || roomCode.length !== 6 || (!user && !localStorage.getItem('userId'))}
                className="w-full"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Joining...
                  </>
                ) : (
                  'Join Room'
                )}
              </Button>
            </form>
            {!user && !localStorage.getItem('userId') && (
              <p className="text-xs text-center text-gray-500">
                Sign in required to join rooms
              </p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* QR Code Modal */}
      {showQRModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
          <Card className="w-full max-w-md animate-in zoom-in-95">
            <CardHeader className="relative">
              <Button
                size="sm"
                variant="ghost"
                className="absolute right-2 top-2"
                onClick={() => setShowQRModal(false)}
              >
                <X className="h-4 w-4" />
              </Button>
              <CardTitle>Share Room</CardTitle>
              <CardDescription>
                Scan QR code or share the room code
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="text-center">
                {qrCodeUrl && (
                  <img src={qrCodeUrl} alt="Room QR Code" className="mx-auto" />
                )}
                <p className="mt-2 text-sm text-gray-600">
                  Scan to join instantly
                </p>
              </div>
              
              <div className="flex items-center gap-2">
                <Input 
                  value={createdRoomCode} 
                  readOnly 
                  className="text-center text-2xl font-mono tracking-wider" 
                />
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    navigator.clipboard.writeText(createdRoomCode)
                    toast({ title: 'Code copied!' })
                  }}
                >
                  Copy
                </Button>
              </div>
              
              <Button onClick={handleShare} className="w-full">
                <Share2 className="mr-2 h-4 w-4" />
                Share Link
              </Button>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  )
}

export default function DecideTogetherPage() {
  return (
    <Suspense fallback={null}>
      <DecideTogetherPageInner />
    </Suspense>
  );
} 