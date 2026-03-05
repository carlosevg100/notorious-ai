'use client'

import { useEffect, useState } from 'react'
import { supabase } from './supabase'
import type { Document } from './types'

export function useDocuments(projectId: string) {
  const [documents, setDocuments] = useState<Document[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setLoading(true)
    supabase
      .from('documents')
      .select('*')
      .eq('project_id', projectId)
      .order('created_at', { ascending: false })
      .then(({ data }) => {
        setDocuments(data || [])
        setLoading(false)
      })

    const channel = supabase
      .channel(`documents:${projectId}`)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'documents',
        filter: `project_id=eq.${projectId}`
      }, (payload) => {
        if (payload.eventType === 'INSERT') {
          setDocuments(prev => [payload.new as Document, ...prev])
        } else if (payload.eventType === 'UPDATE') {
          setDocuments(prev => prev.map(d =>
            d.id === (payload.new as Document).id ? payload.new as Document : d
          ))
        } else if (payload.eventType === 'DELETE') {
          setDocuments(prev => prev.filter(d => d.id !== (payload.old as Document).id))
        }
      })
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [projectId])

  return { documents, loading }
}
