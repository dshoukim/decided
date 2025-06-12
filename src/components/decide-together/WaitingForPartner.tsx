'use client'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Loader2, Users } from 'lucide-react'
import { useTournamentStore } from '@/lib/stores/tournamentStore'

export function WaitingForPartner() {
  const partnerProgress = useTournamentStore(state => state.partnerProgress)
  const userProgress = useTournamentStore(state => state.userProgress)
  
  return (
    <div className="max-w-2xl mx-auto p-4">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            Waiting for Your Partner
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex justify-center">
            <Loader2 className="h-12 w-12 animate-spin text-purple-600" />
          </div>
          
          <div className="text-center space-y-2">
            <p className="text-lg font-medium">Your partner is still making their picks...</p>
            <p className="text-sm text-gray-600">
              They've completed {partnerProgress.completedPicks} of {partnerProgress.totalPicks} picks
            </p>
          </div>
          
          <div className="bg-gray-50 dark:bg-gray-900 rounded-lg p-4 space-y-3">
            <div>
              <div className="flex justify-between text-sm mb-1">
                <span>Your Progress</span>
                <span className="text-green-600">Complete ✓</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div 
                  className="bg-green-600 h-2 rounded-full transition-all duration-300"
                  style={{ width: '100%' }}
                />
              </div>
            </div>
            
            <div>
              <div className="flex justify-between text-sm mb-1">
                <span>Partner Progress</span>
                <span>{Math.round((partnerProgress.completedPicks / partnerProgress.totalPicks) * 100)}%</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div 
                  className="bg-purple-600 h-2 rounded-full transition-all duration-300"
                  style={{ width: `${(partnerProgress.completedPicks / partnerProgress.totalPicks) * 100}%` }}
                />
              </div>
            </div>
          </div>
          
          <p className="text-center text-sm text-gray-500">
            The next round will start automatically when both of you have completed your picks
          </p>
        </CardContent>
      </Card>
    </div>
  )
} 