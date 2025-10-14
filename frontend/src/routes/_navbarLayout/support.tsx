import { createFileRoute } from '@tanstack/react-router'
import { useState, useEffect, useRef } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Separator } from '@/components/ui/separator'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Send, MessageCircle, Clock, User, HeadphonesIcon } from 'lucide-react'
import { format } from 'date-fns'
import { getSupportSocket, disconnectSupportSocket } from '@/lib/websocket'

export const Route = createFileRoute('/_navbarLayout/support')({
  component: RouteComponent,
})

interface Message {
  _id: string
  senderId: {
    _id: string
    name: string
    email: string
  }
  text: string
  isRead: boolean
  createdAt: string
  updatedAt: string
}

interface Conversation {
  _id: string
  userId: {
    _id: string
    name: string
    email: string
  }
  messages: Message[]
  createdAt: string
  updatedAt: string
}

interface UserInfo {
  id: string
  name: string
  email: string
}

function RouteComponent() {
  const [userInfo, setUserInfo] = useState<UserInfo | null>(null)
  const [conversations, setConversations] = useState<Conversation[]>([])
  const [selectedConversation, setSelectedConversation] = useState<Conversation | null>(null)
  const [myConversation, setMyConversation] = useState<Conversation | null>(null)
  const [newMessage, setNewMessage] = useState('')
  const [loading, setLoading] = useState(true)
  const [sendingMessage, setSendingMessage] = useState(false)
  const [isTyping, setIsTyping] = useState(false)
  const [typingUsers, setTypingUsers] = useState<string[]>([])
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const typingTimeoutRef = useRef<NodeJS.Timeout>()

  const supportEmail = 'mohammad@gen7fuel.com'
  const isSupport = userInfo?.email === supportEmail

  // Get user info from token
  const getUserInfo = () => {
    const token = localStorage.getItem('token')
    if (!token) return null
    
    try {
      const payload = JSON.parse(atob(token.split('.')[1]))
      return {
        id: payload.user?.id || payload.id,
        name: payload.user?.name || payload.name,
        email: payload.user?.email || payload.email
      }
    } catch (error) {
      console.error('Error parsing token:', error)
      return null
    }
  }

  // Initialize WebSocket connection
  useEffect(() => {
    const supportSocket = getSupportSocket()

    // Listen for new messages
    supportSocket.on('new-message', (data) => {
      console.log('📨 New message received:', data)
      
      if (isSupport) {
        // Update conversations list
        setConversations(prev => 
          prev.map(conv => 
            conv._id === data.conversationId ? data.conversation : conv
          )
        )
        // Update selected conversation if it matches
        if (selectedConversation?._id === data.conversationId) {
          setSelectedConversation(data.conversation)
        }
      } else {
        // Update user's own conversation
        if (myConversation?._id === data.conversationId) {
          setMyConversation(data.conversation)
        }
      }
      
      // Scroll to bottom
      setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 100)
    })

    // Listen for message sent confirmation
    supportSocket.on('message-sent', (data) => {
      console.log('✅ Message sent confirmation:', data)
      setSendingMessage(false)
    })

    // Listen for conversation updates (support staff only)
    supportSocket.on('conversation-updated', (updatedConversation) => {
      console.log('🔄 Conversation updated:', updatedConversation)
      if (isSupport) {
        setConversations(prev => 
          prev.map(conv => 
            conv._id === updatedConversation._id ? updatedConversation : conv
          )
        )
      }
    })

    // Listen for typing indicators
    supportSocket.on('user-typing', (data) => {
      console.log('⌨️ User typing:', data)
      if (data.isTyping) {
        setTypingUsers(prev => [...prev.filter(u => u !== data.userName), data.userName || 'Support'])
      } else {
        setTypingUsers(prev => prev.filter(u => u !== (data.userName || 'Support')))
      }
    })

    // Listen for messages read
    supportSocket.on('messages-read', (data) => {
      console.log('👁️ Messages read:', data)
      // Refresh conversations or update read status
      if (isSupport) {
        fetchAllConversations()
      } else {
        fetchMyConversation()
      }
    })

    // Listen for errors
    supportSocket.on('error', (error) => {
      console.error('❌ Support socket error:', error)
      setSendingMessage(false)
    })

    // Cleanup on unmount
    return () => {
      supportSocket.off('new-message')
      supportSocket.off('message-sent')
      supportSocket.off('conversation-updated')
      supportSocket.off('user-typing')
      supportSocket.off('messages-read')
      supportSocket.off('error')
      disconnectSupportSocket()
    }
  }, [isSupport, selectedConversation?._id, myConversation?._id])

  // Fetch all conversations (support staff only)
  const fetchAllConversations = async () => {
    try {
      const response = await fetch('/api/support/conversations', {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      })
      if (response.ok) {
        const data = await response.json()
        setConversations(data)
      }
    } catch (error) {
      console.error('Error fetching conversations:', error)
    }
  }

  // Fetch user's own conversation
  const fetchMyConversation = async () => {
    try {
      const response = await fetch('/api/support/my-conversation', {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      })
      if (response.ok) {
        const data = await response.json()
        setMyConversation(data)
      }
    } catch (error) {
      console.error('Error fetching my conversation:', error)
    }
  }

  // Send message via WebSocket
  const sendMessage = async () => {
    if (!newMessage.trim() || sendingMessage) return

    const targetConversation = isSupport ? selectedConversation : myConversation
    if (!targetConversation) return

    setSendingMessage(true)
    
    const supportSocket = getSupportSocket()
    supportSocket.emit('send-message', {
      conversationId: targetConversation._id,
      text: newMessage
    })
    
    setNewMessage('')
    
    // Stop typing indicator
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current)
    }
    supportSocket.emit('typing', {
      conversationId: targetConversation._id,
      isTyping: false
    })
  }

  // Handle typing indicator
  const handleTyping = (e: React.ChangeEvent<HTMLInputElement>) => {
    setNewMessage(e.target.value)
    
    const targetConversation = isSupport ? selectedConversation : myConversation
    if (!targetConversation) return
    
    const supportSocket = getSupportSocket()
    
    if (!isTyping) {
      setIsTyping(true)
      supportSocket.emit('typing', {
        conversationId: targetConversation._id,
        isTyping: true
      })
    }
    
    // Clear existing timeout
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current)
    }
    
    // Set new timeout to stop typing
    typingTimeoutRef.current = setTimeout(() => {
      setIsTyping(false)
      supportSocket.emit('typing', {
        conversationId: targetConversation._id,
        isTyping: false
      })
    }, 1000)
  }

  // Mark as read via WebSocket
  const markAsRead = async (conversationId: string) => {
    const supportSocket = getSupportSocket()
    supportSocket.emit('mark-as-read', { conversationId })
  }

  // Get unread message count for a conversation
  const getUnreadCount = (conversation: Conversation) => {
    if (!userInfo) return 0
    return conversation.messages.filter(msg => 
      !msg.isRead && msg.senderId._id !== userInfo.id
    ).length
  }

  // Get last message preview
  const getLastMessage = (conversation: Conversation) => {
    if (conversation.messages.length === 0) return 'No messages yet'
    const lastMsg = conversation.messages[conversation.messages.length - 1]
    return lastMsg.text.length > 50 ? lastMsg.text.substring(0, 50) + '...' : lastMsg.text
  }

  // Get last message time
  const getLastMessageTime = (conversation: Conversation) => {
    if (conversation.messages.length === 0) return ''
    const lastMsg = conversation.messages[conversation.messages.length - 1]
    return format(new Date(lastMsg.createdAt), 'MMM dd, HH:mm')
  }

  useEffect(() => {
    const user = getUserInfo()
    setUserInfo(user)
    
    if (user) {
      if (user.email === supportEmail) {
        fetchAllConversations()
      } else {
        fetchMyConversation()
      }
    }
    setLoading(false)
  }, [])

  useEffect(() => {
    const targetConversation = isSupport ? selectedConversation : myConversation
    if (targetConversation) {
      markAsRead(targetConversation._id)
      setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 100)
    }
  }, [selectedConversation, myConversation])

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      sendMessage()
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-lg">Loading support chat...</div>
      </div>
    )
  }

  // Message input component with typing indicator
  const messageInput = (
    <div className="p-4">
      <div className="flex gap-2">
        <Input
          value={newMessage}
          onChange={handleTyping}
          onKeyPress={handleKeyPress}
          placeholder="Type your message..."
          disabled={sendingMessage}
          className="flex-1"
        />
        <Button 
          onClick={sendMessage} 
          disabled={!newMessage.trim() || sendingMessage}
          size="icon"
        >
          <Send className="h-4 w-4" />
        </Button>
      </div>
      {/* Typing indicator */}
      {typingUsers.length > 0 && (
        <div className="text-xs text-gray-500 mt-2">
          {typingUsers.join(', ')} {typingUsers.length === 1 ? 'is' : 'are'} typing...
        </div>
      )}
    </div>
  )

  // Regular user view - single conversation
  if (!isSupport) {
    return (
      <div className="container mx-auto p-6 mt-12 h-[calc(100vh-120px)]">
        <Card className="h-full flex flex-col">
          <CardHeader className="border-b">
            <div className="flex items-center gap-3">
              <Avatar className="h-10 w-10">
                <AvatarFallback>
                  <HeadphonesIcon className="h-5 w-5" />
                </AvatarFallback>
              </Avatar>
              <div>
                <CardTitle className="text-lg">Support Chat</CardTitle>
                <p className="text-sm text-gray-600">Get help from our support team</p>
              </div>
              {myConversation && (
                <div className="ml-auto text-sm text-gray-500">
                  {myConversation.messages.length} messages
                </div>
              )}
            </div>
          </CardHeader>

          <CardContent className="flex-1 flex flex-col p-0">
            {/* Messages Area */}
            <ScrollArea className="flex-1 p-4">
              <div className="space-y-4">
                {!myConversation || myConversation.messages.length === 0 ? (
                  <div className="text-center text-gray-500 py-8">
                    <MessageCircle className="h-12 w-12 mx-auto mb-4 opacity-50" />
                    <h3 className="text-lg font-medium mb-2">Start a conversation</h3>
                    <p>Send a message to get help from our support team</p>
                  </div>
                ) : (
                  myConversation.messages.map((message, index) => {
                    const isSupport = message.senderId.email === supportEmail
                    const showDate = index === 0 || 
                      format(new Date(message.createdAt), 'yyyy-MM-dd') !== 
                      format(new Date(myConversation.messages[index - 1].createdAt), 'yyyy-MM-dd')

                    return (
                      <div key={message._id}>
                        {showDate && (
                          <div className="flex justify-center my-4">
                            <Badge variant="outline" className="text-xs">
                              {format(new Date(message.createdAt), 'MMMM dd, yyyy')}
                            </Badge>
                          </div>
                        )}
                        <div className={`flex ${isSupport ? 'justify-start' : 'justify-end'}`}>
                          <div className={`max-w-[80%] ${isSupport ? 'order-2' : ''}`}>
                            {isSupport && (
                              <div className="flex items-center gap-2 mb-1">
                                <Avatar className="h-6 w-6">
                                  <AvatarFallback className="text-xs">
                                    <HeadphonesIcon className="h-3 w-3" />
                                  </AvatarFallback>
                                </Avatar>
                                <span className="text-xs text-gray-600">Support</span>
                              </div>
                            )}
                            <div
                              className={`p-3 rounded-lg ${
                                isSupport
                                  ? 'bg-gray-100 text-gray-900'
                                  : 'bg-primary text-primary-foreground'
                              }`}
                            >
                              <p className="text-sm whitespace-pre-wrap">{message.text}</p>
                              <p className={`text-xs mt-1 ${isSupport ? 'text-gray-500' : 'text-primary-foreground/70'}`}>
                                {format(new Date(message.createdAt), 'HH:mm')}
                              </p>
                            </div>
                          </div>
                          {isSupport && (
                            <Avatar className="h-8 w-8 order-1 mr-2">
                              <AvatarFallback className="text-xs">
                                <HeadphonesIcon className="h-4 w-4" />
                              </AvatarFallback>
                            </Avatar>
                          )}
                        </div>
                      </div>
                    )
                  })
                )}
                <div ref={messagesEndRef} />
              </div>
            </ScrollArea>

            <Separator />
            {messageInput}
          </CardContent>
        </Card>
      </div>
    )
  }

  // Support staff view - all conversations
  return (
    <div className="container mx-auto p-6 mt-12 h-[calc(100vh-120px)]">
      <div className="flex gap-6 h-full">
        {/* Left Panel - Conversations List */}
        <Card className="w-1/3 flex flex-col">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <MessageCircle className="h-5 w-5" />
              Support Conversations ({conversations.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="flex-1 p-0">
            <ScrollArea className="h-full">
              <div className="space-y-2 p-4">
                {conversations.length === 0 ? (
                  <div className="text-center text-gray-500 py-8">
                    <MessageCircle className="h-12 w-12 mx-auto mb-2 opacity-50" />
                    <p>No conversations yet</p>
                  </div>
                ) : (
                  conversations.map((conversation) => {
                    const unreadCount = getUnreadCount(conversation)
                    const isSelected = selectedConversation?._id === conversation._id
                    
                    return (
                      <div
                        key={conversation._id}
                        className={`p-3 rounded-lg cursor-pointer transition-colors border ${
                          isSelected 
                            ? 'bg-primary/10 border-primary' 
                            : 'hover:bg-gray-50 border-gray-200'
                        }`}
                        onClick={() => setSelectedConversation(conversation)}
                      >
                        <div className="flex items-start justify-between">
                          <div className="flex items-center gap-3 flex-1">
                            <Avatar className="h-10 w-10">
                              <AvatarFallback>
                                <User className="h-5 w-5" />
                              </AvatarFallback>
                            </Avatar>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2">
                                <h4 className="font-medium text-sm truncate">
                                  {conversation.userId.name}
                                </h4>
                                {unreadCount > 0 && (
                                  <Badge variant="destructive" className="text-xs">
                                    {unreadCount}
                                  </Badge>
                                )}
                              </div>
                              <p className="text-xs text-gray-600 truncate">
                                {conversation.userId.email}
                              </p>
                              <p className="text-xs text-gray-500 truncate mt-1">
                                {getLastMessage(conversation)}
                              </p>
                            </div>
                          </div>
                          <div className="text-xs text-gray-400 flex items-center gap-1">
                            <Clock className="h-3 w-3" />
                            {getLastMessageTime(conversation)}
                          </div>
                        </div>
                      </div>
                    )
                  })
                )}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>

        {/* Right Panel - Chat Messages */}
        <Card className="flex-1 flex flex-col">
          {selectedConversation ? (
            <>
              <CardHeader className="border-b">
                <div className="flex items-center gap-3">
                  <Avatar className="h-10 w-10">
                    <AvatarFallback>
                      <User className="h-5 w-5" />
                    </AvatarFallback>
                  </Avatar>
                  <div>
                    <CardTitle className="text-lg">
                      {selectedConversation.userId.name}
                    </CardTitle>
                    <p className="text-sm text-gray-600">
                      {selectedConversation.userId.email}
                    </p>
                  </div>
                  <div className="ml-auto text-sm text-gray-500">
                    {selectedConversation.messages.length} messages
                  </div>
                </div>
              </CardHeader>

              <CardContent className="flex-1 flex flex-col p-0">
                {/* Messages Area */}
                <ScrollArea className="flex-1 p-4">
                  <div className="space-y-4">
                    {selectedConversation.messages.map((message, index) => {
                      const isSupport = message.senderId.email === supportEmail
                      const showDate = index === 0 || 
                        format(new Date(message.createdAt), 'yyyy-MM-dd') !== 
                        format(new Date(selectedConversation.messages[index - 1].createdAt), 'yyyy-MM-dd')

                      return (
                        <div key={message._id}>
                          {showDate && (
                            <div className="flex justify-center my-4">
                              <Badge variant="outline" className="text-xs">
                                {format(new Date(message.createdAt), 'MMMM dd, yyyy')}
                              </Badge>
                            </div>
                          )}
                          <div className={`flex ${isSupport ? 'justify-end' : 'justify-start'}`}>
                            <div className={`max-w-[80%] ${!isSupport ? 'order-2' : ''}`}>
                              {!isSupport && (
                                <div className="flex items-center gap-2 mb-1">
                                  <Avatar className="h-6 w-6">
                                    <AvatarFallback className="text-xs">U</AvatarFallback>
                                  </Avatar>
                                  <span className="text-xs text-gray-600">{message.senderId.name}</span>
                                </div>
                              )}
                              <div
                                className={`p-3 rounded-lg ${
                                  isSupport
                                    ? 'bg-primary text-primary-foreground'
                                    : 'bg-gray-100 text-gray-900'
                                }`}
                              >
                                <p className="text-sm whitespace-pre-wrap">{message.text}</p>
                                <p className={`text-xs mt-1 ${isSupport ? 'text-primary-foreground/70' : 'text-gray-500'}`}>
                                  {format(new Date(message.createdAt), 'HH:mm')}
                                </p>
                              </div>
                            </div>
                            {!isSupport && (
                              <Avatar className="h-8 w-8 order-1 mr-2">
                                <AvatarFallback className="text-xs">U</AvatarFallback>
                              </Avatar>
                            )}
                          </div>
                        </div>
                      )
                    })}
                    <div ref={messagesEndRef} />
                  </div>
                </ScrollArea>

                <Separator />
                {messageInput}
              </CardContent>
            </>
          ) : (
            <CardContent className="flex-1 flex items-center justify-center">
              <div className="text-center text-gray-500">
                <MessageCircle className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <h3 className="text-lg font-medium mb-2">Select a conversation</h3>
                <p>Choose a conversation from the left to view messages</p>
              </div>
            </CardContent>
          )}
        </Card>
      </div>
    </div>
  )
}
// import { createFileRoute } from '@tanstack/react-router'
// import { useState, useEffect, useRef } from 'react'
// import { Button } from '@/components/ui/button'
// import { Input } from '@/components/ui/input'
// import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
// import { Badge } from '@/components/ui/badge'
// import { ScrollArea } from '@/components/ui/scroll-area'
// import { Separator } from '@/components/ui/separator'
// import { Avatar, AvatarFallback } from '@/components/ui/avatar'
// import { Send, MessageCircle, Clock, User, HeadphonesIcon } from 'lucide-react'
// import { format } from 'date-fns'

// export const Route = createFileRoute('/_navbarLayout/support')({
//   component: RouteComponent,
// })

// interface Message {
//   _id: string
//   senderId: {
//     _id: string
//     name: string
//     email: string
//   }
//   text: string
//   isRead: boolean
//   createdAt: string
//   updatedAt: string
// }

// interface Conversation {
//   _id: string
//   userId: {
//     _id: string
//     name: string
//     email: string
//   }
//   messages: Message[]
//   createdAt: string
//   updatedAt: string
// }

// interface UserInfo {
//   id: string
//   name: string
//   email: string
// }

// function RouteComponent() {
//   const [userInfo, setUserInfo] = useState<UserInfo | null>(null)
//   const [conversations, setConversations] = useState<Conversation[]>([])
//   const [selectedConversation, setSelectedConversation] = useState<Conversation | null>(null)
//   const [myConversation, setMyConversation] = useState<Conversation | null>(null)
//   const [newMessage, setNewMessage] = useState('')
//   const [loading, setLoading] = useState(true)
//   const [sendingMessage, setSendingMessage] = useState(false)
//   const messagesEndRef = useRef<HTMLDivElement>(null)

//   const supportEmail = 'mohammad@gen7fuel.com'
//   const isSupport = userInfo?.email === supportEmail

//   // Get user info from token
//   const getUserInfo = () => {
//     const token = localStorage.getItem('token')
//     if (!token) return null
    
//     try {
//       const payload = JSON.parse(atob(token.split('.')[1]))
//       return {
//         id: payload.user?.id || payload.id,
//         name: payload.user?.name || payload.name,
//         email: payload.user?.email || payload.email
//       }
//     } catch (error) {
//       console.error('Error parsing token:', error)
//       return null
//     }
//   }

//   // Fetch all conversations (support staff only)
//   const fetchAllConversations = async () => {
//     try {
//       const response = await fetch('/api/support/conversations', {
//         headers: {
//           'Authorization': `Bearer ${localStorage.getItem('token')}`
//         }
//       })
//       if (response.ok) {
//         const data = await response.json()
//         setConversations(data)
//       }
//     } catch (error) {
//       console.error('Error fetching conversations:', error)
//     }
//   }

//   // Fetch user's own conversation
//   const fetchMyConversation = async () => {
//     try {
//       const response = await fetch('/api/support/my-conversation', {
//         headers: {
//           'Authorization': `Bearer ${localStorage.getItem('token')}`
//         }
//       })
//       if (response.ok) {
//         const data = await response.json()
//         setMyConversation(data)
//       }
//     } catch (error) {
//       console.error('Error fetching my conversation:', error)
//     }
//   }

//   // Send a new message
//   const sendMessage = async () => {
//     if (!newMessage.trim() || sendingMessage) return

//     const targetConversation = isSupport ? selectedConversation : myConversation
//     if (!targetConversation) return

//     setSendingMessage(true)
//     try {
//       const response = await fetch(`/api/support/conversations/${targetConversation._id}/messages`, {
//         method: 'POST',
//         headers: {
//           'Content-Type': 'application/json',
//           'Authorization': `Bearer ${localStorage.getItem('token')}`
//         },
//         body: JSON.stringify({ text: newMessage })
//       })

//       if (response.ok) {
//         const updatedConversation = await response.json()
        
//         if (isSupport) {
//           // Update conversations list for support
//           setConversations(prev => 
//             prev.map(conv => 
//               conv._id === updatedConversation._id ? updatedConversation : conv
//             )
//           )
//           setSelectedConversation(updatedConversation)
//         } else {
//           // Update user's own conversation
//           setMyConversation(updatedConversation)
//         }
        
//         setNewMessage('')
        
//         // Scroll to bottom
//         setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 100)
//       }
//     } catch (error) {
//       console.error('Error sending message:', error)
//     } finally {
//       setSendingMessage(false)
//     }
//   }

//   // Mark messages as read
//   const markAsRead = async (conversationId: string) => {
//     try {
//       await fetch(`/api/support/conversations/${conversationId}/read`, {
//         method: 'POST',
//         headers: {
//           'Authorization': `Bearer ${localStorage.getItem('token')}`
//         }
//       })
//     } catch (error) {
//       console.error('Error marking as read:', error)
//     }
//   }

//   // Get unread message count for a conversation
//   const getUnreadCount = (conversation: Conversation) => {
//     if (!userInfo) return 0
//     return conversation.messages.filter(msg => 
//       !msg.isRead && msg.senderId._id !== userInfo.id
//     ).length
//   }

//   // Get last message preview
//   const getLastMessage = (conversation: Conversation) => {
//     if (conversation.messages.length === 0) return 'No messages yet'
//     const lastMsg = conversation.messages[conversation.messages.length - 1]
//     return lastMsg.text.length > 50 ? lastMsg.text.substring(0, 50) + '...' : lastMsg.text
//   }

//   // Get last message time
//   const getLastMessageTime = (conversation: Conversation) => {
//     if (conversation.messages.length === 0) return ''
//     const lastMsg = conversation.messages[conversation.messages.length - 1]
//     return format(new Date(lastMsg.createdAt), 'MMM dd, HH:mm')
//   }

//   useEffect(() => {
//     const user = getUserInfo()
//     setUserInfo(user)
    
//     if (user) {
//       if (user.email === supportEmail) {
//         fetchAllConversations()
//       } else {
//         fetchMyConversation()
//       }
//     }
//     setLoading(false)
//   }, [])

//   useEffect(() => {
//     const targetConversation = isSupport ? selectedConversation : myConversation
//     if (targetConversation) {
//       markAsRead(targetConversation._id)
//       setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 100)
//     }
//   }, [selectedConversation, myConversation])

//   const handleKeyPress = (e: React.KeyboardEvent) => {
//     if (e.key === 'Enter' && !e.shiftKey) {
//       e.preventDefault()
//       sendMessage()
//     }
//   }

//   if (loading) {
//     return (
//       <div className="flex items-center justify-center h-96">
//         <div className="text-lg">Loading support chat...</div>
//       </div>
//     )
//   }

//   // Regular user view - single conversation
//   if (!isSupport) {
//     return (
//       <div className="container mx-auto p-6 mt-12 h-[calc(100vh-120px)]">
//         <Card className="h-full flex flex-col">
//           <CardHeader className="border-b">
//             <div className="flex items-center gap-3">
//               <Avatar className="h-10 w-10">
//                 <AvatarFallback>
//                   <HeadphonesIcon className="h-5 w-5" />
//                 </AvatarFallback>
//               </Avatar>
//               <div>
//                 <CardTitle className="text-lg">Support Chat</CardTitle>
//                 <p className="text-sm text-gray-600">Get help from our support team</p>
//               </div>
//               {myConversation && (
//                 <div className="ml-auto text-sm text-gray-500">
//                   {myConversation.messages.length} messages
//                 </div>
//               )}
//             </div>
//           </CardHeader>

//           <CardContent className="flex-1 flex flex-col p-0">
//             {/* Messages Area */}
//             <ScrollArea className="flex-1 p-4">
//               <div className="space-y-4">
//                 {!myConversation || myConversation.messages.length === 0 ? (
//                   <div className="text-center text-gray-500 py-8">
//                     <MessageCircle className="h-12 w-12 mx-auto mb-4 opacity-50" />
//                     <h3 className="text-lg font-medium mb-2">Start a conversation</h3>
//                     <p>Send a message to get help from our support team</p>
//                   </div>
//                 ) : (
//                   myConversation.messages.map((message, index) => {
//                     const isSupport = message.senderId.email === supportEmail
//                     const showDate = index === 0 || 
//                       format(new Date(message.createdAt), 'yyyy-MM-dd') !== 
//                       format(new Date(myConversation.messages[index - 1].createdAt), 'yyyy-MM-dd')

//                     return (
//                       <div key={message._id}>
//                         {showDate && (
//                           <div className="flex justify-center my-4">
//                             <Badge variant="outline" className="text-xs">
//                               {format(new Date(message.createdAt), 'MMMM dd, yyyy')}
//                             </Badge>
//                           </div>
//                         )}
//                         <div className={`flex ${isSupport ? 'justify-start' : 'justify-end'}`}>
//                           <div className={`max-w-[80%] ${isSupport ? 'order-2' : ''}`}>
//                             {isSupport && (
//                               <div className="flex items-center gap-2 mb-1">
//                                 <Avatar className="h-6 w-6">
//                                   <AvatarFallback className="text-xs">
//                                     <HeadphonesIcon className="h-3 w-3" />
//                                   </AvatarFallback>
//                                 </Avatar>
//                                 <span className="text-xs text-gray-600">Support</span>
//                               </div>
//                             )}
//                             <div
//                               className={`p-3 rounded-lg ${
//                                 isSupport
//                                   ? 'bg-gray-100 text-gray-900'
//                                   : 'bg-primary text-primary-foreground'
//                               }`}
//                             >
//                               <p className="text-sm whitespace-pre-wrap">{message.text}</p>
//                               <p className={`text-xs mt-1 ${isSupport ? 'text-gray-500' : 'text-primary-foreground/70'}`}>
//                                 {format(new Date(message.createdAt), 'HH:mm')}
//                               </p>
//                             </div>
//                           </div>
//                           {isSupport && (
//                             <Avatar className="h-8 w-8 order-1 mr-2">
//                               <AvatarFallback className="text-xs">
//                                 <HeadphonesIcon className="h-4 w-4" />
//                               </AvatarFallback>
//                             </Avatar>
//                           )}
//                         </div>
//                       </div>
//                     )
//                   })
//                 )}
//                 <div ref={messagesEndRef} />
//               </div>
//             </ScrollArea>

//             <Separator />

//             {/* Message Input */}
//             <div className="p-4">
//               <div className="flex gap-2">
//                 <Input
//                   value={newMessage}
//                   onChange={(e) => setNewMessage(e.target.value)}
//                   onKeyPress={handleKeyPress}
//                   placeholder="Type your message..."
//                   disabled={sendingMessage}
//                   className="flex-1"
//                 />
//                 <Button 
//                   onClick={sendMessage} 
//                   disabled={!newMessage.trim() || sendingMessage}
//                   size="icon"
//                 >
//                   <Send className="h-4 w-4" />
//                 </Button>
//               </div>
//             </div>
//           </CardContent>
//         </Card>
//       </div>
//     )
//   }

//   // Support staff view - all conversations
//   return (
//     <div className="container mx-auto p-6 mt-12 h-[calc(100vh-120px)]">
//       <div className="flex gap-6 h-full">
//         {/* Left Panel - Conversations List */}
//         <Card className="w-1/3 flex flex-col">
//           <CardHeader>
//             <CardTitle className="flex items-center gap-2">
//               <MessageCircle className="h-5 w-5" />
//               Support Conversations ({conversations.length})
//             </CardTitle>
//           </CardHeader>
//           <CardContent className="flex-1 p-0">
//             <ScrollArea className="h-full">
//               <div className="space-y-2 p-4">
//                 {conversations.length === 0 ? (
//                   <div className="text-center text-gray-500 py-8">
//                     <MessageCircle className="h-12 w-12 mx-auto mb-2 opacity-50" />
//                     <p>No conversations yet</p>
//                   </div>
//                 ) : (
//                   conversations.map((conversation) => {
//                     const unreadCount = getUnreadCount(conversation)
//                     const isSelected = selectedConversation?._id === conversation._id
                    
//                     return (
//                       <div
//                         key={conversation._id}
//                         className={`p-3 rounded-lg cursor-pointer transition-colors border ${
//                           isSelected 
//                             ? 'bg-primary/10 border-primary' 
//                             : 'hover:bg-gray-50 border-gray-200'
//                         }`}
//                         onClick={() => setSelectedConversation(conversation)}
//                       >
//                         <div className="flex items-start justify-between">
//                           <div className="flex items-center gap-3 flex-1">
//                             <Avatar className="h-10 w-10">
//                               <AvatarFallback>
//                                 <User className="h-5 w-5" />
//                               </AvatarFallback>
//                             </Avatar>
//                             <div className="flex-1 min-w-0">
//                               <div className="flex items-center gap-2">
//                                 <h4 className="font-medium text-sm truncate">
//                                   {conversation.userId.name}
//                                 </h4>
//                                 {unreadCount > 0 && (
//                                   <Badge variant="destructive" className="text-xs">
//                                     {unreadCount}
//                                   </Badge>
//                                 )}
//                               </div>
//                               <p className="text-xs text-gray-600 truncate">
//                                 {conversation.userId.email}
//                               </p>
//                               <p className="text-xs text-gray-500 truncate mt-1">
//                                 {getLastMessage(conversation)}
//                               </p>
//                             </div>
//                           </div>
//                           <div className="text-xs text-gray-400 flex items-center gap-1">
//                             <Clock className="h-3 w-3" />
//                             {getLastMessageTime(conversation)}
//                           </div>
//                         </div>
//                       </div>
//                     )
//                   })
//                 )}
//               </div>
//             </ScrollArea>
//           </CardContent>
//         </Card>

//         {/* Right Panel - Chat Messages */}
//         <Card className="flex-1 flex flex-col">
//           {selectedConversation ? (
//             <>
//               <CardHeader className="border-b">
//                 <div className="flex items-center gap-3">
//                   <Avatar className="h-10 w-10">
//                     <AvatarFallback>
//                       <User className="h-5 w-5" />
//                     </AvatarFallback>
//                   </Avatar>
//                   <div>
//                     <CardTitle className="text-lg">
//                       {selectedConversation.userId.name}
//                     </CardTitle>
//                     <p className="text-sm text-gray-600">
//                       {selectedConversation.userId.email}
//                     </p>
//                   </div>
//                   <div className="ml-auto text-sm text-gray-500">
//                     {selectedConversation.messages.length} messages
//                   </div>
//                 </div>
//               </CardHeader>

//               <CardContent className="flex-1 flex flex-col p-0">
//                 {/* Messages Area */}
//                 <ScrollArea className="flex-1 p-4">
//                   <div className="space-y-4">
//                     {selectedConversation.messages.map((message, index) => {
//                       const isSupport = message.senderId.email === supportEmail
//                       const showDate = index === 0 || 
//                         format(new Date(message.createdAt), 'yyyy-MM-dd') !== 
//                         format(new Date(selectedConversation.messages[index - 1].createdAt), 'yyyy-MM-dd')

//                       return (
//                         <div key={message._id}>
//                           {showDate && (
//                             <div className="flex justify-center my-4">
//                               <Badge variant="outline" className="text-xs">
//                                 {format(new Date(message.createdAt), 'MMMM dd, yyyy')}
//                               </Badge>
//                             </div>
//                           )}
//                           <div className={`flex ${isSupport ? 'justify-end' : 'justify-start'}`}>
//                             <div className={`max-w-[80%] ${!isSupport ? 'order-2' : ''}`}>
//                               {!isSupport && (
//                                 <div className="flex items-center gap-2 mb-1">
//                                   <Avatar className="h-6 w-6">
//                                     <AvatarFallback className="text-xs">U</AvatarFallback>
//                                   </Avatar>
//                                   <span className="text-xs text-gray-600">{message.senderId.name}</span>
//                                 </div>
//                               )}
//                               <div
//                                 className={`p-3 rounded-lg ${
//                                   isSupport
//                                     ? 'bg-primary text-primary-foreground'
//                                     : 'bg-gray-100 text-gray-900'
//                                 }`}
//                               >
//                                 <p className="text-sm whitespace-pre-wrap">{message.text}</p>
//                                 <p className={`text-xs mt-1 ${isSupport ? 'text-primary-foreground/70' : 'text-gray-500'}`}>
//                                   {format(new Date(message.createdAt), 'HH:mm')}
//                                 </p>
//                               </div>
//                             </div>
//                             {!isSupport && (
//                               <Avatar className="h-8 w-8 order-1 mr-2">
//                                 <AvatarFallback className="text-xs">U</AvatarFallback>
//                               </Avatar>
//                             )}
//                           </div>
//                         </div>
//                       )
//                     })}
//                     <div ref={messagesEndRef} />
//                   </div>
//                 </ScrollArea>

//                 <Separator />

//                 {/* Message Input */}
//                 <div className="p-4">
//                   <div className="flex gap-2">
//                     <Input
//                       value={newMessage}
//                       onChange={(e) => setNewMessage(e.target.value)}
//                       onKeyPress={handleKeyPress}
//                       placeholder="Type your message..."
//                       disabled={sendingMessage}
//                       className="flex-1"
//                     />
//                     <Button 
//                       onClick={sendMessage} 
//                       disabled={!newMessage.trim() || sendingMessage}
//                       size="icon"
//                     >
//                       <Send className="h-4 w-4" />
//                     </Button>
//                   </div>
//                 </div>
//               </CardContent>
//             </>
//           ) : (
//             <CardContent className="flex-1 flex items-center justify-center">
//               <div className="text-center text-gray-500">
//                 <MessageCircle className="h-12 w-12 mx-auto mb-4 opacity-50" />
//                 <h3 className="text-lg font-medium mb-2">Select a conversation</h3>
//                 <p>Choose a conversation from the left to view messages</p>
//               </div>
//             </CardContent>
//           )}
//         </Card>
//       </div>
//     </div>
//   )
// }