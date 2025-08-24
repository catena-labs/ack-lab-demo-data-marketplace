"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { toast } from "sonner"
import { 
  FileText, 
  Database, 
  TrendingUp, 
  Download, 
  DollarSign, 
  MessageSquare,
  CheckCircle2,
  ArrowUpDown,
  Loader2,
  ShoppingCart,
  Key
} from "lucide-react"

// Data catalogue matching the server
const dataCatalogue = [
  {
    id: "housing_inventory_2024",
    name: "US Housing Market Inventory 2024",
    description: "Comprehensive housing inventory data across all US metropolitan areas for 2024",
    format: "CSV",
    size: "12 MB",
    listPrice: 300,
    minimumPrice: 200,
    category: "housing",
    icon: Database
  },
  {
    id: "spy_ticker_365d",
    name: "SPY Minute-Level Ticker Data (365 days)",
    description: "Minute-by-minute ticker data for SPDR S&P 500 ETF (SPY) for the last 365 days",
    format: "CSV",
    size: "5 MB",
    listPrice: 350,
    minimumPrice: 250,
    category: "ticker",
    icon: TrendingUp
  },
  {
    id: "llm_benchmark_paper",
    name: "Comprehensive LLM Benchmarking Study 2024",
    description: "Academic paper analyzing performance benchmarks of major LLMs with detailed methodology",
    format: "PDF",
    size: "2.5 MB",
    listPrice: 200,
    minimumPrice: 150,
    category: "llm_paper",
    icon: FileText
  }
]

const RESEARCHER_BUDGET = 275

interface NegotiationStep {
   id: string  // Add unique ID for stable keys
  type: 'researcher' | 'provider' | 'system'
  message: string
  price?: number
  action?: 'offer' | 'counter' | 'accept' | 'payment' | 'complete'
  timestamp: Date
}

export function DataNegotiationInterface() {
  const [selectedResource, setSelectedResource] = useState<string | null>(null)
  const [negotiationSteps, setNegotiationSteps] = useState<NegotiationStep[]>([])
  const [currentOffer, setCurrentOffer] = useState<number | null>(null)
  const [isNegotiating, setIsNegotiating] = useState(false)
  const [paymentToken, setPaymentToken] = useState<string | null>(null)
  const [accessToken, setAccessToken] = useState<string | null>(null)
  const [negotiationPhase, setNegotiationPhase] = useState<'browsing' | 'negotiating' | 'payment' | 'complete'>('browsing')

  const startNegotiation = async (resourceId: string) => {
    setSelectedResource(resourceId)
    setIsNegotiating(true)
    setNegotiationPhase('negotiating')
    setNegotiationSteps([])
    
    const resource = dataCatalogue.find(r => r.id === resourceId)
    if (!resource) return

    // Add initial system message
    setNegotiationSteps([
      {
        id: `system-${Date.now()}-${Math.random()}`,
        type: 'system',
        message: `Starting negotiation for ${resource.name}`,
        timestamp: new Date()
      }
    ])

    try {
      // Call the agent to start negotiation
      const response = await fetch('/api/negotiation/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          resourceId,
          researchTopic: getResearchTopicForResource(resourceId)
        })
      })

      await response.json()
      
      // Add researcher's initial interest
      setNegotiationSteps(prev => [...prev, {
        id: `researcher-${Date.now()}-${Math.random()}`,
        type: 'researcher',
        message: `I'm interested in ${resource.name} for my research.`,
        timestamp: new Date()
      }])

      // Add provider's response with list price
      setNegotiationSteps(prev => [...prev, {
        id: `provider-${Date.now()}-${Math.random()}`,
        type: 'provider',
        message: `${resource.name} is available for $${resource.listPrice}. This is a high-quality dataset that will be perfect for your research.`,
        price: resource.listPrice,
        action: 'offer',
        timestamp: new Date()
      }])

      // Auto-negotiate if price is over budget
      if (resource.listPrice > RESEARCHER_BUDGET) {
        setTimeout(() => makeOffer(Math.floor(resource.listPrice * 0.8)), 1500)
      } else {
        setCurrentOffer(resource.listPrice)
      }
    } catch (error) {
      console.error('Error starting negotiation:', error)
      toast.error('Failed to start negotiation')
      setIsNegotiating(false)
    }
  }

  const makeOffer = async (amount: number) => {
    if (!selectedResource) return
    
    const resource = dataCatalogue.find(r => r.id === selectedResource)
    if (!resource) return

    setCurrentOffer(amount)
    
    // Add researcher's offer
    setNegotiationSteps(prev => [...prev, {
      id: `researcher-offer-${Date.now()}-${Math.random()}`,
      type: 'researcher',
      message: `I can offer $${amount} for this resource. That's within my research budget.`,
      price: amount,
      action: 'offer',
      timestamp: new Date()
    }])

    // Simulate provider response
    setTimeout(() => {
      if (amount >= resource.minimumPrice) {
        // Accept offer
        setNegotiationSteps(prev => [...prev, {
          id: `provider-accept-${Date.now()}-${Math.random()}`,
          type: 'provider',
          message: `I accept your offer of $${amount}. Let's proceed with the payment.`,
          price: amount,
          action: 'accept',
          timestamp: new Date()
        }])
        
        // Generate payment request
        setTimeout(() => requestPayment(amount), 1000)
      } else {
        // Counter offer
        const counterOffer = Math.max(
          resource.minimumPrice,
          Math.floor((amount + resource.listPrice) / 2)
        )
        
        setNegotiationSteps(prev => [...prev, {
          id: `provider-counter-${Date.now()}-${Math.random()}`,
          type: 'provider',
          message: `I cannot accept $${amount}. The minimum I can go is $${resource.minimumPrice}. Would you consider $${counterOffer}?`,
          price: counterOffer,
          action: 'counter',
          timestamp: new Date()
        }])
        
        setCurrentOffer(counterOffer)
        
        // Auto-accept if within budget
        if (counterOffer <= RESEARCHER_BUDGET) {
          setTimeout(() => acceptOffer(counterOffer), 2000)
        }
      }
    }, 1500)
  }

  const acceptOffer = async (amount: number) => {
    setNegotiationSteps(prev => [...prev, {
      id: `researcher-accept-${Date.now()}-${Math.random()}`,
      type: 'researcher',
      message: `I accept your offer of $${amount}. Let's proceed.`,
      price: amount,
      action: 'accept',
      timestamp: new Date()
    }])
    
    setTimeout(() => requestPayment(amount), 1000)
  }

  const requestPayment = async (amount: number) => {
    setNegotiationPhase('payment')
    
    // Generate a mock payment token
    const token = `pay_${Math.random().toString(36).substring(2, 15)}_${Date.now()}`
    setPaymentToken(token)
    
    setNegotiationSteps(prev => [...prev, {
      id: `system-payment-${Date.now()}-${Math.random()}`,
      type: 'system',
      message: `Payment request created for $${amount}. Processing payment...`,
      price: amount,
      action: 'payment',
      timestamp: new Date()
    }])
    
    // Auto-execute payment after a delay
    setTimeout(() => executePayment(token, amount), 2000)
  }

  const executePayment = async (token: string, amount: number) => {
    try {
      // Simulate payment execution
      const response = await fetch('/api/negotiation/pay', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ paymentToken: token, amount })
      })
      
      if (!response.ok) throw new Error('Payment failed')
      
      await response.json()
      
      setNegotiationSteps(prev => [...prev, {
        id: `system-complete-${Date.now()}-${Math.random()}`,
        type: 'system',
        message: `Payment of $${amount} completed successfully!`,
        action: 'complete',
        timestamp: new Date()
      }])
      
      // Generate access token
      const accessTkn = `access_${selectedResource}_${Date.now()}_${Math.random().toString(36).substring(2, 15)}`
      setAccessToken(accessTkn)
      
      setNegotiationSteps(prev => [...prev, {
        id: `provider-complete-${Date.now()}-${Math.random()}`,
        type: 'provider',
        message: `Payment confirmed! Here's your access token for the data: ${accessTkn}`,
        action: 'complete',
        timestamp: new Date()
      }])
      
      setNegotiationPhase('complete')
      toast.success('Transaction completed successfully!')
    } catch (error) {
      console.error('Payment error:', error)
      toast.error('Payment failed')
    }
  }

  const getResearchTopicForResource = (resourceId: string) => {
    const topics: Record<string, string> = {
      'housing_inventory_2024': 'housing market inventory',
      'spy_ticker_365d': 'ticker prices on S&P 500',
      'llm_benchmark_paper': 'papers about LLMs'
    }
    return topics[resourceId] || 'general research'
  }

  const resetNegotiation = () => {
    setSelectedResource(null)
    setNegotiationSteps([])
    setCurrentOffer(null)
    setIsNegotiating(false)
    setPaymentToken(null)
    setAccessToken(null)
    setNegotiationPhase('browsing')
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-900 dark:to-gray-800 p-8">
      <div className="max-w-7xl mx-auto">
        <div className="mb-8 text-center">
          <h1 className="text-4xl font-bold mb-2 bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
            Data Marketplace
          </h1>
          <p className="text-gray-600 dark:text-gray-400">
            AI Agents Negotiating Research Data Purchases
          </p>
        </div>

        {/* Budget Display */}
        <Card className="mb-6 p-4 bg-gradient-to-r from-blue-50 to-purple-50 dark:from-blue-950 dark:to-purple-950 border-0">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <DollarSign className="h-5 w-5 text-blue-600" />
              <span className="font-semibold">Research Budget:</span>
              <Badge variant="secondary" className="text-lg px-3">
                ${RESEARCHER_BUDGET}
              </Badge>
            </div>
            {negotiationPhase === 'complete' && (
              <Button onClick={resetNegotiation} variant="outline" size="sm">
                Start New Negotiation
              </Button>
            )}
          </div>
        </Card>

        <Tabs defaultValue="catalog" className="space-y-6">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="catalog" className="flex items-center gap-2">
              <ShoppingCart className="h-4 w-4" />
              Data Catalog
            </TabsTrigger>
            <TabsTrigger value="negotiation" className="flex items-center gap-2">
              <MessageSquare className="h-4 w-4" />
              Negotiation
              {negotiationSteps.length > 0 && (
                <Badge variant="secondary" className="ml-1">
                  {negotiationSteps.length}
                </Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="transaction" className="flex items-center gap-2">
              <Key className="h-4 w-4" />
              Transaction
            </TabsTrigger>
          </TabsList>

          <TabsContent value="catalog" className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {dataCatalogue.map((resource) => {
                const Icon = resource.icon
                const isOverBudget = resource.listPrice > RESEARCHER_BUDGET
                
                return (
                  <Card 
                    key={resource.id} 
                    className={`p-6 hover:shadow-lg transition-all cursor-pointer ${
                      selectedResource === resource.id ? 'ring-2 ring-blue-500' : ''
                    }`}
                    onClick={() => !isNegotiating && startNegotiation(resource.id)}
                  >
                    <div className="flex items-start justify-between mb-4">
                      <Icon className="h-8 w-8 text-blue-600" />
                      <Badge variant={isOverBudget ? "destructive" : "default"}>
                        ${resource.listPrice}
                      </Badge>
                    </div>
                    
                    <h3 className="font-semibold text-lg mb-2">{resource.name}</h3>
                    <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                      {resource.description}
                    </p>
                    
                    <div className="flex items-center justify-between text-sm">
                      <span className="flex items-center gap-1">
                        <Badge variant="outline">{resource.format}</Badge>
                        <span className="text-gray-500">{resource.size}</span>
                      </span>
                      {isOverBudget && (
                        <span className="text-xs text-orange-600 dark:text-orange-400">
                          Negotiation needed
                        </span>
                      )}
                    </div>
                    
                    {resource.minimumPrice < resource.listPrice && (
                      <div className="mt-3 pt-3 border-t">
                        <div className="flex items-center justify-between text-xs text-gray-500">
                          <span>Min: ${resource.minimumPrice}</span>
                          <span>Savings up to ${resource.listPrice - resource.minimumPrice}</span>
                        </div>
                      </div>
                    )}
                  </Card>
                )
              })}
            </div>
          </TabsContent>

          <TabsContent value="negotiation" className="space-y-4">
            {negotiationSteps.length === 0 ? (
              <Card className="p-12 text-center">
                <MessageSquare className="h-12 w-12 mx-auto mb-4 text-gray-400" />
                <p className="text-gray-600 dark:text-gray-400">
                  Select a resource from the catalog to start negotiation
                </p>
              </Card>
            ) : (
              <Card className="p-6">
                <div className="space-y-4 max-h-[500px] overflow-y-auto" style={{ transform: 'translateZ(0)' }}>
                  {negotiationSteps.map((step) => (
                    <div
                      key={step.id}
                      className={`flex w-full ${
                        step.type === 'researcher' ? 'justify-start' : 'justify-end'
                      }`}
                      style={{ minHeight: '60px', transform: 'translateZ(0)', willChange: 'auto' }}
                    >
                      <div
                        className={`relative max-w-[70%] rounded-lg p-4 transition-none ${
                          step.type === 'researcher'
                            ? 'bg-blue-100 dark:bg-blue-900'
                            : step.type === 'provider'
                            ? 'bg-purple-100 dark:bg-purple-900'
                            : 'bg-gray-100 dark:bg-gray-800'
                        }`}
                      >
                        <div className="mb-2">
                          {step.type === 'researcher' && (
                            <Badge variant="outline">Researcher</Badge>
                          )}
                          {step.type === 'provider' && (
                            <Badge variant="outline">Data Provider</Badge>
                          )}
                          {step.type === 'system' && (
                            <Badge variant="secondary">System</Badge>
                          )}
                        </div>
                        
                        <p className="text-sm">{step.message}</p>
                        
                        {step.price && (
                          <div className="mt-2 flex items-center gap-2">
                            <DollarSign className="h-4 w-4 flex-shrink-0" />
                            <span className="font-semibold">${step.price}</span>
                            {step.action === 'accept' && (
                              <CheckCircle2 className="h-4 w-4 text-green-600 flex-shrink-0" />
                            )}
                            {step.action === 'counter' && (
                              <ArrowUpDown className="h-4 w-4 text-orange-600 flex-shrink-0" />
                            )}
                          </div>
                        )}
                        
                        <span className="text-xs text-gray-500 mt-2 block">
                          {step.timestamp.toLocaleTimeString()}
                        </span>
                      </div>
                    </div>
                  ))}
                  
                  {isNegotiating && negotiationPhase === 'negotiating' && (
                    <div className="flex justify-center">
                      <Loader2 className="h-6 w-6 animate-spin text-blue-600" />
                    </div>
                  )}
                </div>
                
                {negotiationPhase === 'negotiating' && currentOffer && currentOffer > RESEARCHER_BUDGET && (
                  <Alert className="mt-4">
                    <AlertDescription>
                      The current offer of ${currentOffer} exceeds your budget. 
                      Consider making a counter-offer within your ${RESEARCHER_BUDGET} budget.
                    </AlertDescription>
                  </Alert>
                )}
              </Card>
            )}
          </TabsContent>

          <TabsContent value="transaction" className="space-y-4">
            {negotiationPhase !== 'payment' && negotiationPhase !== 'complete' ? (
              <Card className="p-12 text-center">
                <Key className="h-12 w-12 mx-auto mb-4 text-gray-400" />
                <p className="text-gray-600 dark:text-gray-400">
                  Complete a negotiation to see transaction details
                </p>
              </Card>
            ) : (
              <div className="space-y-4">
                {negotiationPhase === 'payment' && (
                  <Card className="p-6">
                    <h3 className="font-semibold mb-4 flex items-center gap-2">
                      <Loader2 className="h-5 w-5 animate-spin" />
                      Processing Payment
                    </h3>
                    <Progress value={66} className="mb-4" />
                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between">
                        <span>Payment Token:</span>
                        <code className="text-xs bg-gray-100 dark:bg-gray-800 px-2 py-1 rounded">
                          {paymentToken?.substring(0, 20)}...
                        </code>
                      </div>
                    </div>
                  </Card>
                )}
                
                {negotiationPhase === 'complete' && accessToken && (
                  <Card className="p-6 bg-gradient-to-r from-green-50 to-emerald-50 dark:from-green-950 dark:to-emerald-950">
                    <h3 className="font-semibold mb-4 flex items-center gap-2 text-green-700 dark:text-green-300">
                      <CheckCircle2 className="h-5 w-5" />
                      Transaction Complete
                    </h3>
                    
                    <div className="space-y-4">
                      <div className="bg-white dark:bg-gray-800 rounded-lg p-4 space-y-3">
                        <div className="flex justify-between items-center">
                          <span className="font-medium">Access Token:</span>
                          <Button size="sm" variant="outline" className="gap-2">
                            <Download className="h-4 w-4" />
                            Download Data
                          </Button>
                        </div>
                        <code className="block text-xs bg-gray-100 dark:bg-gray-900 p-3 rounded overflow-x-auto">
                          {accessToken}
                        </code>
                      </div>
                      
                      <Alert>
                        <CheckCircle2 className="h-4 w-4" />
                        <AlertDescription>
                          Your data is now available for download. The access token has been 
                          securely generated and can be used to retrieve your research data.
                        </AlertDescription>
                      </Alert>
                    </div>
                  </Card>
                )}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </div>
  )
}
