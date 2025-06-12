import useSWR from 'swr'
import { supabase } from '../supabase'
import { User } from '@supabase/supabase-js'

const fetchUser = async (key: string): Promise<User | null> => {
  const { data, error } = await supabase.auth.getUser()

  if (error) {
    console.error('Error fetching user:', error)
    return null
  }

  return data.user
}

export const useUser = () => {
  const { data, error, mutate } = useSWR<User | null>('user', fetchUser)

  return {
    user: data,
    isLoading: !error && !data,
    isError: error,
    mutate,
  }
} 