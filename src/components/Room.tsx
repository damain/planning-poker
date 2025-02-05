import { useState, useEffect } from 'react'
import { useParams, useSearchParams } from 'react-router-dom'
import { supabase, subscribeToRoom, createStory, setCurrentStory, toggleShowVotes, editStory } from '../lib/supabase'
import type { Database } from '../lib/database.types'
import toast, { Toaster } from 'react-hot-toast';

type Room = Database['public']['Tables']['rooms']['Row']
type Vote = Database['public']['Tables']['votes']['Row']
type Story = Database['public']['Tables']['stories']['Row']

const FIBONACCI_NUMBERS = [1, 2, 3, 5, 8, 13, 21]

export function Room() {
  const { roomCode } = useParams<{ roomCode: string }>()
  const [searchParams] = useSearchParams()
  const userName = searchParams.get('user') || ''
  
  const [room, setRoom] = useState<Room | null>(null)
  const [stories, setStories] = useState<Story[]>([])
  const [votes, setVotes] = useState<Vote[]>([])
  const [selectedValue, setSelectedValue] = useState<number | null>(null)
  const [error, setError] = useState('')
  const [isAddingStory, setIsAddingStory] = useState(false)
  const [newStoryTitle, setNewStoryTitle] = useState('')
  const [newStoryDescription, setNewStoryDescription] = useState('')
  const [editingStory, setEditingStory] = useState<Story | null>(null)
  const [isUsernameModalOpen, setIsUsernameModalOpen] = useState(false)
  const [tempUserName, setTempUserName] = useState('')
  const [users, setUsers] = useState<string[]>([])
  
  useEffect(() => {
    if (!roomCode) return

    const loadRoom = async () => {
      try {
        const { data: roomData, error: roomError } = await supabase
          .from('rooms')
          .select('*')
          .eq('code', roomCode)
          .single()

        if (roomError) throw roomError
        setRoom(roomData)

        // Load all stories for the room
        const { data: storyData, error: storyError } = await supabase
          .from('stories')
          .select('*')
          .eq('room_code', roomCode)
          .order('created_at', { ascending: false })

        if (storyError) throw storyError
        setStories(storyData)

        // Load votes for current story
        if (roomData.current_story) {
          const { data: voteData, error: voteError } = await supabase
            .from('votes')
            .select('*')
            .eq('room_code', roomCode)
            .eq('story_id', roomData.current_story)

          if (voteError) throw voteError
          setVotes(voteData)
        }
      } catch (err) {
        setError('Failed to load room data')
        console.error(err)
      }
    }

    loadRoom()

    // Subscribe to room changes
    const subscription = supabase
      .channel('public:rooms')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'rooms',
          filter: `code=eq.${roomCode}`
        },
        (payload) => {
          console.log('Room change event received:', payload)
          setRoom(payload.new as Room)
        }
      )
      .subscribe()

    console.log('Room subscription created for room:', roomCode)

    // Subscribe to story changes
    const storySubscription = supabase
      .channel('public:stories')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'stories',
          filter: `room_code=eq.${roomCode}`
        },
        (payload) => {
          console.log('Story change event received:', payload)
          
          // Load all stories again to ensure consistency
          supabase
            .from('stories')
            .select('*')
            .eq('room_code', roomCode)
            .order('created_at', { ascending: false })
            .then(({ data, error }) => {
              if (!error && data) {
                console.log('Reloaded stories:', data)
                setStories(data)
              }
            })
        }
      )
      .subscribe()

    // Subscribe to vote changes
    const voteSubscription = supabase
      .channel('public:votes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'votes',
          filter: `room_code=eq.${roomCode}${room?.current_story ? ` AND story_id=eq.${room.current_story}` : ''}`
        },
        (payload) => {
          console.log('Vote change event received:', payload)
          
          // Reload votes for current story
          if (room?.current_story) {
            supabase
              .from('votes')
              .select('*')
              .eq('room_code', roomCode)
              .eq('story_id', room.current_story)
              .then(({ data, error }) => {
                if (!error && data) {
                  console.log('Reloaded votes:', data)
                  setVotes(data)
                }
              })
          }
        }
      )
      .subscribe()

    console.log('Subscriptions created for room:', roomCode)

    return () => {
      subscription.unsubscribe()
      storySubscription.unsubscribe()
      voteSubscription.unsubscribe()
    }
  }, [roomCode, room])

  useEffect(() => {
    if (!roomCode || !room?.current_story) {
      setVotes([]);
      setSelectedValue(null);
      return;
    }

    const loadVotes = async () => {
      try {
        const { data: voteData, error: voteError } = await supabase
          .from('votes')
          .select('*')
          .eq('room_code', roomCode)
          .eq('story_id', room.current_story)

        if (voteError) throw voteError
        setVotes(voteData || [])

        // Set selected value for current user
        const userVote = voteData?.find(v => v.user_name === userName)
        setSelectedValue(userVote?.vote_value || null)
      } catch (err) {
        console.error('Failed to load votes:', err)
        setVotes([])
        setSelectedValue(null)
      }
    }

    loadVotes()
  }, [roomCode, room?.current_story, userName])

  useEffect(() => {
    if (!roomCode || !room) return;

    const voteSubscription = supabase
      .channel('public:votes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'votes',
          filter: `room_code=eq.${roomCode}${room.current_story ? ` AND story_id=eq.${room.current_story}` : ''}`
        },
        (payload) => {
          console.log('Vote change event received:', payload)
          
          // Reload votes for current story
          if (room.current_story) {
            supabase
              .from('votes')
              .select('*')
              .eq('room_code', roomCode)
              .eq('story_id', room.current_story)
              .then(({ data, error }) => {
                if (!error && data) {
                  console.log('Reloaded votes:', data)
                  setVotes(data)
                }
              })
          }
        }
      )
      .subscribe()

    return () => {
      voteSubscription.unsubscribe()
    }
  }, [roomCode, room])

  useEffect(() => {
    if (!userName) {
      setIsUsernameModalOpen(true)
    }
  }, [userName])

  useEffect(() => {
    if (!roomCode || !userName) return

    const addUserToRoom = async () => {
      try {
        // Get existing users
        const { data: existingUsers } = await supabase
          .from('room_users')
          .select('user_name')
          .eq('room_code', roomCode)
        
        const userNames = existingUsers?.map(u => u.user_name).sort() || []
        
        if (!userNames.includes(userName)) {
          await supabase
            .from('room_users')
            .insert({
              room_code: roomCode,
              user_name: userName,
              last_seen: new Date().toISOString()
            })
        } else {
          // Update last_seen
          await supabase
            .from('room_users')
            .update({ last_seen: new Date().toISOString() })
            .eq('room_code', roomCode)
            .eq('user_name', userName)
        }

        setUsers(userNames.includes(userName) ? userNames : [...userNames, userName].sort())
      } catch (err) {
        console.error('Failed to add user to room:', err)
      }
    }

    addUserToRoom()

    // Keep user's last_seen timestamp updated
    const interval = setInterval(async () => {
      try {
        await supabase
          .from('room_users')
          .update({ last_seen: new Date().toISOString() })
          .eq('room_code', roomCode)
          .eq('user_name', userName)
      } catch (err) {
        console.error('Failed to update last_seen:', err)
      }
    }, 30000) // Every 30 seconds

    // Subscribe to room_users changes
    const userSubscription = supabase
      .channel('public:room_users')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'room_users',
          filter: `room_code=eq.${roomCode}`
        },
        async () => {
          // Reload all active users
          const { data: activeUsers } = await supabase
            .from('room_users')
            .select('user_name')
            .eq('room_code', roomCode)
            .gte('last_seen', new Date(Date.now() - 60000).toISOString()) // Active in last minute
          
          setUsers((activeUsers?.map(u => u.user_name) || []).sort())
        }
      )
      .subscribe()

    return () => {
      clearInterval(interval)
      userSubscription.unsubscribe()
    }
  }, [roomCode, userName])

  const handleSetUsername = (e: React.FormEvent) => {
    e.preventDefault()
    if (!tempUserName.trim()) return

    const searchParams = new URLSearchParams(window.location.search)
    searchParams.set('user', tempUserName)
    window.history.replaceState(null, '', `${window.location.pathname}?${searchParams.toString()}`)
    window.location.reload()
  }

  const handleVote = async (value: number) => {
    try {
      const { data: existingVote } = await supabase
        .from('votes')
        .select('id')
        .eq('room_code', roomCode)
        .eq('story_id', room.current_story)
        .eq('user_name', userName)
        .single()

      if (existingVote) {
        await supabase
          .from('votes')
          .update({ vote_value: value })
          .eq('id', existingVote.id)
      } else {
        await supabase
          .from('votes')
          .insert({
            room_code: roomCode,
            story_id: room.current_story,
            user_name: userName,
            vote_value: value
          })
      }

      setSelectedValue(value)
    } catch (err) {
      setError('Failed to submit vote')
      console.error(err)
    }
  }

  const handleAddStory = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newStoryTitle.trim()) {
      setError('Story title is required')
      return
    }

    try {
      const { data: story, error } = await supabase
        .from('stories')
        .insert({
          room_code: roomCode,
          title: newStoryTitle,
          description: newStoryDescription
        })
        .select()
        .single()

      if (error) throw error

      setNewStoryTitle('')
      setNewStoryDescription('')
      setIsAddingStory(false)
      
      // If no current story is selected, set this as current
      if (!room?.current_story && story) {
        await setCurrentStory(roomCode!, story.id.toString())
      }
    } catch (err) {
      setError('Failed to create story')
      console.error(err)
    }
  }

  const handleSelectStory = async (storyId: number) => {
    try {
      await setCurrentStory(roomCode!, storyId.toString())
      // Reset votes when changing stories
      setVotes([])
      setSelectedValue(null)
    } catch (err) {
      setError('Failed to select story')
      console.error(err)
    }
  }

  const handleToggleVotes = async () => {
    if (!room) return
    try {
      await toggleShowVotes(roomCode!, !room.show_votes)
    } catch (err) {
      setError('Failed to toggle votes')
      console.error(err)
    }
  }

  const handleEditStory = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!editingStory) return

    if (!editingStory.title.trim()) {
      setError('Story title is required')
      return
    }

    try {
      await editStory(editingStory.id, {
        title: editingStory.title,
        description: editingStory.description || undefined
      })
      setEditingStory(null)
    } catch (err) {
      setError('Failed to update story')
      console.error(err)
    }
  }

  const copyRoomLink = async () => {
    try {
      // Create a clean URL without the username parameter
      const url = new URL(window.location.href);
      url.searchParams.delete('user');
      await navigator.clipboard.writeText(url.toString());
      toast.success('Room link copied to clipboard!');
    } catch (err) {
      toast.error('Failed to copy room link');
    }
  };

  if (!room) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-900">
        <div className="text-xl text-gray-200">Loading...</div>
      </div>
    )
  }

  const currentStory = stories.find(s => s.id.toString() === room.current_story)

  return (
    <div className="min-h-screen bg-gray-900 text-white p-8">
      <Toaster position="top-right" />
      <div className="mx-auto max-w-7xl">
        <div className="rounded-lg bg-gray-800 px-5 py-6 shadow-lg ring-1 ring-gray-700/50 sm:px-6">
          <div className="border-b border-gray-700 pb-5">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-lg font-medium text-gray-200">
                  Room: {room.name} (Code: {room.code})
                </h3>
                <p className="mt-2 text-sm text-gray-400">
                  Joined as: {userName}
                </p>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => setIsAddingStory(true)}
                  className="rounded-md bg-indigo-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 focus:ring-offset-gray-800"
                >
                  Add Story
                </button>
                <button
                  onClick={copyRoomLink}
                  className="flex items-center gap-2 px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg transition-colors"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                    <path d="M8 3a1 1 0 011-1h2a1 1 0 110 2H9a1 1 0 01-1-1z" />
                    <path d="M6 3a2 2 0 00-2 2v11a2 2 0 002 2h8a2 2 0 002-2V5a2 2 0 00-2-2 3 3 0 01-3 3H9a3 3 0 01-3-3z" />
                  </svg>
                  Share Room
                </button>
              </div>
            </div>
          </div>

          {error && (
            <div className="mt-4 rounded-md bg-red-900/50 p-4">
              <div className="flex">
                <div className="flex-shrink-0">
                  <svg className="h-5 w-5 text-red-400" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                  </svg>
                </div>
                <div className="ml-3">
                  <p className="text-sm text-red-400">{error}</p>
                </div>
              </div>
            </div>
          )}

          {isAddingStory && (
            <div className="mt-6">
              <form onSubmit={handleAddStory} className="space-y-4">
                <div>
                  <label htmlFor="storyTitle" className="block text-sm font-medium text-gray-200">
                    Story Title
                  </label>
                  <input
                    type="text"
                    id="storyTitle"
                    value={newStoryTitle}
                    onChange={(e) => setNewStoryTitle(e.target.value)}
                    className="mt-1 block w-full rounded-md border border-gray-600 bg-gray-700 px-3 py-2 text-white shadow-sm placeholder:text-gray-400 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 sm:text-sm"
                    placeholder="Enter story title"
                  />
                </div>
                <div>
                  <label htmlFor="storyDescription" className="block text-sm font-medium text-gray-200">
                    Description (optional)
                  </label>
                  <textarea
                    id="storyDescription"
                    value={newStoryDescription}
                    onChange={(e) => setNewStoryDescription(e.target.value)}
                    rows={3}
                    className="mt-1 block w-full rounded-md border border-gray-600 bg-gray-700 px-3 py-2 text-white shadow-sm placeholder:text-gray-400 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 sm:text-sm"
                    placeholder="Enter story description"
                  />
                </div>
                <div className="flex justify-end space-x-3">
                  <button
                    type="button"
                    onClick={() => setIsAddingStory(false)}
                    className="rounded-md bg-gray-700 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2 focus:ring-offset-gray-800"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="rounded-md bg-indigo-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 focus:ring-offset-gray-800"
                  >
                    Add Story
                  </button>
                </div>
              </form>
            </div>
          )}

          {editingStory && (
            <div className="fixed inset-0 z-10 overflow-y-auto">
              <div className="flex min-h-screen items-end justify-center px-4 pb-20 pt-4 text-center sm:block sm:p-0">
                <div className="fixed inset-0 transition-opacity" aria-hidden="true">
                  <div className="absolute inset-0 bg-gray-900 opacity-75"></div>
                </div>

                <span className="hidden sm:inline-block sm:h-screen sm:align-middle" aria-hidden="true">&#8203;</span>

                <div className="inline-block transform overflow-hidden rounded-lg bg-gray-800 px-4 pb-4 pt-5 text-left align-bottom shadow-xl transition-all sm:my-8 sm:w-full sm:max-w-lg sm:p-6 sm:align-middle">
                  <div className="absolute right-0 top-0 hidden pr-4 pt-4 sm:block">
                    <button
                      type="button"
                      className="rounded-md bg-gray-800 text-gray-400 hover:text-gray-500 focus:outline-none"
                      onClick={() => setEditingStory(null)}
                    >
                      <span className="sr-only">Close</span>
                      <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>

                  <form onSubmit={handleEditStory} className="space-y-4">
                    <div>
                      <label htmlFor="editStoryTitle" className="block text-sm font-medium text-gray-200">
                        Story Title
                      </label>
                      <input
                        type="text"
                        id="editStoryTitle"
                        value={editingStory.title}
                        onChange={(e) => setEditingStory({ ...editingStory, title: e.target.value })}
                        className="mt-1 block w-full rounded-md border border-gray-600 bg-gray-700 px-3 py-2 text-white shadow-sm placeholder:text-gray-400 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 sm:text-sm"
                        placeholder="Enter story title"
                      />
                    </div>
                    <div>
                      <label htmlFor="editStoryDescription" className="block text-sm font-medium text-gray-200">
                        Description (optional)
                      </label>
                      <textarea
                        id="editStoryDescription"
                        value={editingStory.description || ''}
                        onChange={(e) => setEditingStory({ ...editingStory, description: e.target.value })}
                        rows={3}
                        className="mt-1 block w-full rounded-md border border-gray-600 bg-gray-700 px-3 py-2 text-white shadow-sm placeholder:text-gray-400 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 sm:text-sm"
                        placeholder="Enter story description"
                      />
                    </div>
                    <div className="mt-5 sm:mt-6 sm:grid sm:grid-flow-row-dense sm:grid-cols-2 sm:gap-3">
                      <button
                        type="submit"
                        className="inline-flex w-full justify-center rounded-md bg-indigo-600 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 focus:ring-offset-gray-800 sm:col-start-2"
                      >
                        Save Changes
                      </button>
                      <button
                        type="button"
                        className="mt-3 inline-flex w-full justify-center rounded-md bg-gray-700 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2 focus:ring-offset-gray-800 sm:col-start-1 sm:mt-0"
                        onClick={() => setEditingStory(null)}
                      >
                        Cancel
                      </button>
                    </div>
                  </form>
                </div>
              </div>
            </div>
          )}

          {isUsernameModalOpen && (
            <div className="fixed inset-0 z-10 overflow-y-auto">
              <div className="flex min-h-screen items-end justify-center px-4 pb-20 pt-4 text-center sm:block sm:p-0">
                <div className="fixed inset-0 transition-opacity" aria-hidden="true">
                  <div className="absolute inset-0 bg-gray-900 opacity-75"></div>
                </div>

                <span className="hidden sm:inline-block sm:h-screen sm:align-middle" aria-hidden="true">&#8203;</span>

                <div className="inline-block transform overflow-hidden rounded-lg bg-gray-800 px-4 pb-4 pt-5 text-left align-bottom shadow-xl transition-all sm:my-8 sm:w-full sm:max-w-lg sm:p-6 sm:align-middle">
                  <div className="absolute right-0 top-0 hidden pr-4 pt-4 sm:block">
                    <button
                      type="button"
                      className="rounded-md bg-gray-800 text-gray-400 hover:text-gray-500 focus:outline-none"
                      onClick={() => setIsUsernameModalOpen(false)}
                    >
                      <span className="sr-only">Close</span>
                      <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>

                  <form onSubmit={handleSetUsername} className="space-y-4">
                    <div>
                      <label htmlFor="username" className="block text-sm font-medium text-gray-200">
                        Username
                      </label>
                      <input
                        type="text"
                        id="username"
                        value={tempUserName}
                        onChange={(e) => setTempUserName(e.target.value)}
                        className="mt-1 block w-full rounded-md border border-gray-600 bg-gray-700 px-3 py-2 text-white shadow-sm placeholder:text-gray-400 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 sm:text-sm"
                        placeholder="Enter username"
                      />
                    </div>
                    <div className="mt-5 sm:mt-6 sm:grid sm:grid-flow-row-dense sm:grid-cols-2 sm:gap-3">
                      <button
                        type="submit"
                        className="inline-flex w-full justify-center rounded-md bg-indigo-600 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 focus:ring-offset-gray-800 sm:col-start-2"
                      >
                        Set Username
                      </button>
                      <button
                        type="button"
                        className="mt-3 inline-flex w-full justify-center rounded-md bg-gray-700 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2 focus:ring-offset-gray-800 sm:col-start-1 sm:mt-0"
                        onClick={() => setIsUsernameModalOpen(false)}
                      >
                        Cancel
                      </button>
                    </div>
                  </form>
                </div>
              </div>
            </div>
          )}

          <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-3">
            {/* Stories List */}
            <div className="space-y-4 lg:col-span-1">
              <h4 className="text-lg font-medium text-gray-200">Stories</h4>
              <div className="space-y-2">
                {stories.map((story) => (
                  <div
                    key={story.id}
                    className={`flex items-center justify-between rounded-lg p-4 transition-colors
                      ${story.id.toString() === room.current_story
                        ? 'bg-indigo-600 text-white'
                        : 'bg-gray-700 text-gray-200 hover:bg-gray-600'
                      }
                    `}
                  >
                    <div className="flex-1">
                      <h5 className="font-medium">{story.title}</h5>
                      {story.description && (
                        <p className="mt-1 text-sm opacity-80">{story.description}</p>
                      )}
                      {story.final_estimate && (
                        <p className="mt-2 text-sm">
                          Final estimate: <span className="font-bold">{story.final_estimate}</span>
                        </p>
                      )}
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleSelectStory(story.id)}
                        className={`rounded p-2 hover:bg-gray-600 ${
                          story.id.toString() === room.current_story ? 'bg-indigo-700' : ''
                        }`}
                        title={story.id.toString() === room.current_story ? "Current story" : "Select story"}
                      >
                        {story.id.toString() === room.current_story ? (
                          <svg className="h-5 w-5" viewBox="0 0 24 24" fill="currentColor">
                            <path fillRule="evenodd" d="M19.916 4.626a.75.75 0 01.208 1.04l-9 13.5a.75.75 0 01-1.154.114l-6-6a.75.75 0 011.06-1.06l5.353 5.353 8.493-12.739a.75.75 0 011.04-.208z" clipRule="evenodd" />
                          </svg>
                        ) : (
                          <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
                          </svg>
                        )}
                      </button>
                      <button
                        onClick={() => setEditingStory(story)}
                        className="rounded p-2 hover:bg-gray-600"
                        title="Edit story"
                      >
                        <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                        </svg>
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Current Story and Voting Area */}
            <div className="lg:col-span-2 space-y-6">
              {/* Players and Table Layout */}
              <div className="relative">
                {/* Players around the table */}
                <div className="relative mx-32 my-32">
                  {/* Top Players */}
                  <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/2 flex gap-4">
                    {users.slice(0, 3).map((user) => {
                      const vote = votes.find(v => v.user_name === user)
                      return (
                        <div key={user} className="w-32 h-24">
                          <div className="text-gray-300 font-medium text-center mb-2 truncate">{user}</div>
                          <div className={`card-flip relative h-16 ${room.show_votes && vote ? 'show-vote' : ''}`}>
                            <div className="card-front rounded-lg bg-gray-800 shadow-lg ring-1 ring-white/10 flex items-center justify-center">
                              {vote ? (
                                <div className="w-8 h-12 rounded bg-indigo-600"></div>
                              ) : (
                                <div className="text-gray-500">No vote</div>
                              )}
                            </div>
                            <div className="card-back rounded-lg bg-gray-800 shadow-lg ring-1 ring-white/10 flex items-center justify-center">
                              <div className="text-3xl font-bold text-white">{vote?.vote_value || '-'}</div>
                            </div>
                          </div>
                        </div>
                      )
                    })}
                  </div>

                  {/* Left Players */}
                  <div className="absolute left-0 top-1/2 -translate-x-1/2 -translate-y-1/2 flex flex-col gap-4">
                    {users.slice(3, 5).map((user) => {
                      const vote = votes.find(v => v.user_name === user)
                      return (
                        <div key={user} className="w-32 h-24">
                          <div className="text-gray-300 font-medium text-center mb-2 truncate">{user}</div>
                          <div className={`card-flip relative h-16 ${room.show_votes && vote ? 'show-vote' : ''}`}>
                            <div className="card-front rounded-lg bg-gray-800 shadow-lg ring-1 ring-white/10 flex items-center justify-center">
                              {vote ? (
                                <div className="w-8 h-12 rounded bg-indigo-600"></div>
                              ) : (
                                <div className="text-gray-500">No vote</div>
                              )}
                            </div>
                            <div className="card-back rounded-lg bg-gray-800 shadow-lg ring-1 ring-white/10 flex items-center justify-center">
                              <div className="text-3xl font-bold text-white">{vote?.vote_value || '-'}</div>
                            </div>
                          </div>
                        </div>
                      )
                    })}
                  </div>

                  {/* Right Players */}
                  <div className="absolute right-0 top-1/2 translate-x-1/2 -translate-y-1/2 flex flex-col gap-4">
                    {users.slice(5, 7).map((user) => {
                      const vote = votes.find(v => v.user_name === user)
                      return (
                        <div key={user} className="w-32 h-24">
                          <div className="text-gray-300 font-medium text-center mb-2 truncate">{user}</div>
                          <div className={`card-flip relative h-16 ${room.show_votes && vote ? 'show-vote' : ''}`}>
                            <div className="card-front rounded-lg bg-gray-800 shadow-lg ring-1 ring-white/10 flex items-center justify-center">
                              {vote ? (
                                <div className="w-8 h-12 rounded bg-indigo-600"></div>
                              ) : (
                                <div className="text-gray-500">No vote</div>
                              )}
                            </div>
                            <div className="card-back rounded-lg bg-gray-800 shadow-lg ring-1 ring-white/10 flex items-center justify-center">
                              <div className="text-3xl font-bold text-white">{vote?.vote_value || '-'}</div>
                            </div>
                          </div>
                        </div>
                      )
                    })}
                  </div>

                  {/* Bottom Players */}
                  <div className="absolute bottom-0 left-1/2 -translate-x-1/2 translate-y-1/2 flex gap-4">
                    {users.slice(7, 10).map((user) => {
                      const vote = votes.find(v => v.user_name === user)
                      return (
                        <div key={user} className="w-32 h-24">
                          <div className="text-gray-300 font-medium text-center mb-2 truncate">{user}</div>
                          <div className={`card-flip relative h-16 ${room.show_votes && vote ? 'show-vote' : ''}`}>
                            <div className="card-front rounded-lg bg-gray-800 shadow-lg ring-1 ring-white/10 flex items-center justify-center">
                              {vote ? (
                                <div className="w-8 h-12 rounded bg-indigo-600"></div>
                              ) : (
                                <div className="text-gray-500">No vote</div>
                              )}
                            </div>
                            <div className="card-back rounded-lg bg-gray-800 shadow-lg ring-1 ring-white/10 flex items-center justify-center">
                              <div className="text-3xl font-bold text-white">{vote?.vote_value || '-'}</div>
                            </div>
                          </div>
                        </div>
                      )
                    })}
                  </div>

                  {/* The Table */}
                  <div className="rounded-xl bg-gradient-to-br from-emerald-900/50 to-teal-900/50 p-8 shadow-lg ring-1 ring-white/10">
                    {currentStory ? (
                      <div className="space-y-4">
                        <div className="space-y-2">
                          <h3 className="text-2xl font-bold text-white">{currentStory.title}</h3>
                          {currentStory.description && (
                            <p className="text-lg text-gray-300">{currentStory.description}</p>
                          )}
                        </div>
                      </div>
                    ) : (
                      <div className="text-center text-gray-400">
                        Select a story to start voting
                      </div>
                    )}
                  </div>
                </div>

                {/* Voting Area */}
                {currentStory && (
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <h4 className="text-lg font-medium text-gray-200">Your Vote</h4>
                      <button
                        onClick={handleToggleVotes}
                        className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 focus:ring-offset-gray-800"
                      >
                        {room.show_votes ? 'Hide Votes' : 'Show Votes'}
                      </button>
                    </div>

                    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 md:grid-cols-7">
                      {FIBONACCI_NUMBERS.map((value) => (
                        <button
                          key={value}
                          onClick={() => handleVote(value)}
                          className={`flex h-16 items-center justify-center rounded-lg text-xl font-semibold transition-colors
                            ${selectedValue === value
                              ? 'bg-indigo-600 text-white'
                              : 'bg-gray-700 text-gray-200 hover:bg-gray-600'
                            }
                          `}
                        >
                          {value}
                        </button>
                      ))}
                    </div>

                    {!room.show_votes && votes.length > 0 && (
                      <div className="text-center text-gray-400">
                        {votes.length} vote{votes.length !== 1 ? 's' : ''} cast
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
