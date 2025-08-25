"use client"

import { useState, useEffect } from "react"
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
  DollarSign, 
  MessageSquare,
  CheckCircle2,
  ArrowUpDown,
  Loader2,
  ShoppingCart,
  Download,
  ExternalLink
} from "lucide-react"

// Icon mapping for categories
const categoryIcons = {
  housing: Database,
  ticker: TrendingUp,
  llm_paper: FileText
} as const

interface NegotiationStep {
  id: string
  type: 'researcher' | 'provider' | 'system' | 'agent'
  message: string
  price?: number
  action?: 'offer' | 'counter' | 'accept' | 'payment' | 'complete' | 'inquiry'
  timestamp: Date
}

interface PurchasedData {
  resourceId: string
  name: string
  description: string
  format: string
  size: string
  purchasePrice: number
  downloadUrl: string
  accessToken: string
  purchaseDate: Date
}

export function DataNegotiationInterface() {
  const [selectedResource, setSelectedResource] = useState<string | null>(null)
  const [negotiationSteps, setNegotiationSteps] = useState<NegotiationStep[]>([])
  const [currentOffer, setCurrentOffer] = useState<number | null>(null)
  const [isNegotiating, setIsNegotiating] = useState(false)
  const [isProcessing, setIsProcessing] = useState(false)
  const [paymentToken, setPaymentToken] = useState<string | null>(null)
  const [accessToken, setAccessToken] = useState<string | null>(null)
  const [downloadUrl, setDownloadUrl] = useState<string | null>(null)
  // Receipt ID is logged but not displayed in UI currently
  const [, setReceiptId] = useState<string | null>(null)
  const [negotiationPhase, setNegotiationPhase] = useState<'browsing' | 'negotiating' | 'payment' | 'complete'>('browsing')
  const [researcherBudget, setResearcherBudget] = useState<number>(10)
  const [purchasedData, setPurchasedData] = useState<PurchasedData[]>([])
  const [dataCatalogue, setDataCatalogue] = useState<Array<{
    id: string
    name: string
    description: string
    format: string
    size: string
    listPrice: number
    minimumPrice: number
    category: string
    icon: React.ComponentType<{ className?: string }>
  }>>([])

  // Fetch configuration and data catalogue on component mount
  useEffect(() => {
    fetch('/api/config')
      .then(res => res.json())
      .then(data => {
        if (data.researcherBudget) {
          setResearcherBudget(data.researcherBudget);
        }
        if (data.dataCatalogue) {
          // Add icons to the catalogue items
          const catalogueWithIcons = data.dataCatalogue.map((item: {
            id: string
            name: string
            description: string
            format: string
            size: string
            listPrice: number
            minimumPrice: number
            category: string
          }) => ({
            ...item,
            icon: categoryIcons[item.category as keyof typeof categoryIcons] || Database
          }));
          setDataCatalogue(catalogueWithIcons);
        }
      })
      .catch(err => {
        console.error('Failed to fetch config:', err);
      });
  }, [])

  const getResearchTopicForResource = (resourceId: string) => {
    const topics: Record<string, string> = {
      'housing_inventory_2024': 'housing market inventory',
      'spy_ticker_365d': 'ticker prices on S&P 500',
      'llm_benchmark_paper': 'papers about LLMs'
    }
    return topics[resourceId] || 'general research'
  }

  const startNegotiation = async (resourceId: string) => {
    const resource = dataCatalogue.find(r => r.id === resourceId)
    if (!resource) return
    
    setSelectedResource(resourceId)
    setIsNegotiating(true)
    setIsProcessing(true)
    setNegotiationPhase('negotiating')
    setNegotiationSteps([])
    setCurrentOffer(null)
    setPaymentToken(null)
    setAccessToken(null)
    setDownloadUrl(null)
    setReceiptId(null)

    try {
      // Start negotiation through Agent A
      const response = await fetch('/api/negotiation/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          resourceId,
          researchTopic: getResearchTopicForResource(resourceId)
        })
      })

      const data = await response.json()
      
      if (!response.ok) {
        throw new Error(data.error || 'Failed to start negotiation')
      }
      
      // Parse the agent response to show the conversation
      const agentMessage = data.message || ''
      
      // Add Agent A's initial message
      setNegotiationSteps([{
        id: `agent-a-initial-${Date.now()}`,
        type: 'agent',
        message: agentMessage,
        timestamp: new Date()
      }])

      // Store payment token if already received
      if (data.paymentToken) {
        setPaymentToken(data.paymentToken)
        setNegotiationPhase('payment')
        // Auto-execute payment
        setTimeout(() => executePayment(), 1500)
      }
      
      // Check if download URL is received (rare but possible in fast transactions)
      if (data.downloadUrl) {
        setDownloadUrl(data.downloadUrl)
        setAccessToken(data.downloadUrl.split('token=')[1] || 'completed')
        setNegotiationPhase('complete')
        setIsNegotiating(false) // Clear negotiating state
        
        // Add to purchased data
        const resource = dataCatalogue.find(r => r.id === selectedResource)
        if (resource && data.prices && data.prices.length > 0) {
          setPurchasedData(prev => [...prev, {
            resourceId: resource.id,
            name: resource.name,
            description: resource.description,
            format: resource.format,
            size: resource.size,
            purchasePrice: data.prices[data.prices.length - 1],
            downloadUrl: data.downloadUrl,
            accessToken: data.downloadUrl.split('token=')[1] || 'completed',
            purchaseDate: new Date()
          }])
        }
        
        toast.success('Transaction completed! Data purchased successfully.')
      }
      
      // Set current offer if price is detected
      if (data.prices && data.prices.length > 0) {
        const lastPrice = data.prices[data.prices.length - 1]
        setCurrentOffer(lastPrice)
        
        // If price is over budget, auto-negotiate
        if (lastPrice > researcherBudget && !data.paymentToken) {
          setTimeout(() => continueNegotiation(), 2000)
        }
      }
    } catch (error) {
      console.error('Error starting negotiation:', error)
      toast.error('Failed to start negotiation: ' + (error instanceof Error ? error.message : 'Unknown error'))
      setIsNegotiating(false)
      setNegotiationPhase('browsing')
    } finally {
      setIsProcessing(false)
    }
  }

  const continueNegotiation = async (customMessage?: string) => {
    if (!selectedResource) return
    
    setIsProcessing(true)
    
    try {
      // If no custom message, let the agent continue the conversation naturally
      const message = customMessage || "Please continue the negotiation"
      
      const response = await fetch('/api/negotiation/continue', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message })
      })

      const data = await response.json()
      
      if (!response.ok) {
        throw new Error(data.error || 'Failed to continue negotiation')
      }
      
      // Add the agent's response
      setNegotiationSteps(prev => [...prev, {
        id: `agent-continue-${Date.now()}`,
        type: 'agent',
        message: data.message,
        price: data.prices?.[data.prices.length - 1],
        action: data.status === 'complete' ? 'complete' : data.status === 'payment' ? 'payment' : 'offer',
        timestamp: new Date()
      }])
      
      // Handle different response states
      if (data.paymentToken && !paymentToken) {
        setPaymentToken(data.paymentToken)
        setNegotiationPhase('payment')
        // Auto-execute payment
        setTimeout(() => executePayment(), 1500)
      } else if (data.downloadUrl) {
        setDownloadUrl(data.downloadUrl)
        setAccessToken(data.downloadUrl.split('token=')[1] || 'completed')
        setNegotiationPhase('complete')
        setIsNegotiating(false) // Clear negotiating state
        
        // Add to purchased data
        const resource = dataCatalogue.find(r => r.id === selectedResource)
        if (resource && currentOffer) {
          setPurchasedData(prev => [...prev, {
            resourceId: resource.id,
            name: resource.name,
            description: resource.description,
            format: resource.format,
            size: resource.size,
            purchasePrice: currentOffer,
            downloadUrl: data.downloadUrl,
            accessToken: data.downloadUrl.split('token=')[1] || 'completed',
            purchaseDate: new Date()
          }])
        }
        
        toast.success('Transaction completed! Data purchased successfully.')
      } else if (data.prices && data.prices.length > 0) {
        const lastPrice = data.prices[data.prices.length - 1]
        setCurrentOffer(lastPrice)
        
        // Continue negotiation if needed
        if (lastPrice > researcherBudget && !data.status?.includes('accept')) {
          setTimeout(() => continueNegotiation(), 2000)
        }
      }
      
      if (data.receiptId) {
        setReceiptId(data.receiptId)
        console.log('Receipt ID received:', data.receiptId)
      }
    } catch (error) {
      console.error('Error continuing negotiation:', error)
      toast.error('Failed to continue negotiation')
    } finally {
      setIsProcessing(false)
    }
  }

  const executePayment = async () => {
    if (!paymentToken || !currentOffer) {
      toast.error('Missing payment information')
      return
    }
    
    setIsProcessing(true)
    setNegotiationSteps(prev => [...prev, {
      id: `system-payment-${Date.now()}`,
      type: 'system',
      message: `Processing payment of $${currentOffer}...`,
      action: 'payment',
      timestamp: new Date()
    }])
    
    try {
      // Execute payment through Agent A
      const response = await fetch('/api/negotiation/pay', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          paymentToken, 
          amount: currentOffer 
        })
      })
      
      const paymentResult = await response.json()
      
      if (!response.ok || !paymentResult.success) {
        throw new Error(paymentResult.error || 'Payment failed')
      }
      
      setReceiptId(paymentResult.receiptId)
      
      setNegotiationSteps(prev => [...prev, {
        id: `system-payment-complete-${Date.now()}`,
        type: 'system',
        message: `Payment completed! Receipt: ${paymentResult.receiptId.substring(0, 20)}...`,
        action: 'complete',
        timestamp: new Date()
      }])
      
      // Continue negotiation to get the download URL
      setTimeout(() => {
        continueNegotiation(`Payment completed! Here's my receipt: ${paymentResult.receiptId}`)
      }, 1000)
      
    } catch (error) {
      console.error('Payment error:', error)
      toast.error('Payment failed: ' + (error instanceof Error ? error.message : 'Unknown error'))
      setNegotiationPhase('negotiating')
    } finally {
      setIsProcessing(false)
    }
  }

  const resetNegotiation = () => {
    setSelectedResource(null)
    setNegotiationSteps([])
    setCurrentOffer(null)
    setIsNegotiating(false)
    setIsProcessing(false)
    setPaymentToken(null)
    setAccessToken(null)
    setDownloadUrl(null)
    setReceiptId(null)
    setNegotiationPhase('browsing')
  }

  const getPhaseProgress = () => {
    switch (negotiationPhase) {
      case 'browsing': return 0
      case 'negotiating': return 33
      case 'payment': return 66
      case 'complete': return 100
      default: return 0
    }
  }



  return (
    <div className="w-full max-w-6xl mx-auto p-4 space-y-6">
      <Card className="p-6">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-2xl font-bold mb-2">Data Negotiation Marketplace</h2>
            <p className="text-gray-600">
              AI agents negotiate data prices in real-time. Budget: ${researcherBudget}
            </p>
          </div>
          <Badge variant="outline" className="text-lg px-3 py-1">
            <DollarSign className="w-4 h-4 mr-1" />
            Research Budget: ${researcherBudget}
          </Badge>
        </div>

        {/* Progress Bar */}
        <div className="mb-6">
          <div className="flex justify-between text-sm text-gray-600 mb-2">
            <span className={negotiationPhase === 'browsing' ? 'font-semibold text-blue-600' : ''}>
              Browse
            </span>
            <span className={negotiationPhase === 'negotiating' ? 'font-semibold text-blue-600' : ''}>
              Negotiate
            </span>
            <span className={negotiationPhase === 'payment' ? 'font-semibold text-blue-600' : ''}>
              Payment
            </span>
            <span className={negotiationPhase === 'complete' ? 'font-semibold text-green-600' : ''}>
              Complete
            </span>
          </div>
          <Progress value={getPhaseProgress()} className="h-2" />
        </div>

        <Tabs defaultValue="catalogue" className="w-full">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="catalogue">
              <ShoppingCart className="w-4 h-4 mr-2" />
              Catalogue
            </TabsTrigger>
            <TabsTrigger value="negotiation" disabled={!isNegotiating && negotiationSteps.length === 0}>
              <MessageSquare className="w-4 h-4 mr-2" />
              Negotiation ({negotiationSteps.length})
            </TabsTrigger>
            <TabsTrigger value="purchased">
              <Download className="w-4 h-4 mr-2" />
              Purchased ({purchasedData.length})
            </TabsTrigger>
          </TabsList>

          <TabsContent value="catalogue" className="space-y-4 mt-4">
            {dataCatalogue.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                Loading data catalogue...
              </div>
            ) : (
              dataCatalogue.map(resource => {
                const Icon = resource.icon
                const isOverBudget = resource.listPrice > researcherBudget
                
                return (
                  <Card key={resource.id} className="p-4">
                    <div className="flex items-start justify-between">
                      <div className="flex items-start space-x-4">
                        <div className="p-3 bg-gray-100 rounded-lg">
                          <Icon className="w-6 h-6 text-gray-700" />
                        </div>
                        <div className="flex-1">
                          <h3 className="font-semibold text-lg mb-1">{resource.name}</h3>
                          <p className="text-gray-600 text-sm mb-2">{resource.description}</p>
                          <div className="flex items-center space-x-4 text-sm">
                            <Badge variant="secondary">{resource.format}</Badge>
                            <span className="text-gray-500">{resource.size}</span>
                            <span className="font-semibold">
                              List Price: 
                              <span className={isOverBudget ? 'text-red-600 ml-1' : 'text-green-600 ml-1'}>
                                ${resource.listPrice}
                              </span>
                            </span>
                            {isOverBudget && (
                              <Badge variant="outline" className="text-orange-600">
                                Negotiation Required
                              </Badge>
                            )}
                          </div>
                        </div>
                      </div>
                      <div className="flex flex-col items-end space-y-2">
                        <Button
                          onClick={() => startNegotiation(resource.id)}
                          disabled={isNegotiating || purchasedData.some(p => p.resourceId === resource.id)}
                          variant={
                            purchasedData.some(p => p.resourceId === resource.id) ? "outline" :
                            selectedResource === resource.id && isNegotiating ? "secondary" : 
                            "default"
                          }
                        >
                          {purchasedData.some(p => p.resourceId === resource.id) ? (
                            <>
                              <CheckCircle2 className="w-4 h-4 mr-2" />
                              Purchased
                            </>
                          ) : selectedResource === resource.id && isNegotiating ? (
                            <>
                              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                              Negotiating...
                            </>
                          ) : (
                            <>
                              <ArrowUpDown className="w-4 h-4 mr-2" />
                              Start Negotiation
                            </>
                          )}
                        </Button>
                        {resource.minimumPrice && (
                          <span className="text-xs text-gray-500">
                            Min: ${resource.minimumPrice}
                          </span>
                        )}
                      </div>
                    </div>
                  </Card>
                )
              })
            )}
          </TabsContent>

          <TabsContent value="negotiation" className="mt-4">
            {negotiationSteps.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                No negotiation in progress
              </div>
            ) : (
              <div className="space-y-4">
                <div className="max-h-96 overflow-y-auto space-y-3 p-4 bg-gray-50 rounded-lg">
                  {negotiationSteps.map((step) => (
                    <div
                      key={step.id}
                      className={`p-3 rounded-lg ${
                        step.type === 'researcher' ? 'bg-blue-50 border border-blue-200 ml-8' :
                        step.type === 'provider' ? 'bg-green-50 border border-green-200 mr-8' :
                        step.type === 'agent' ? 'bg-purple-50 border border-purple-200' :
                        'bg-gray-50 border border-gray-200'
                      }`}
                    >
                      <div className="flex items-start justify-between mb-1">
                        <span className="font-semibold text-sm text-gray-700">
                          {step.type === 'researcher' ? '🔬 Researcher Agent' :
                           step.type === 'provider' ? '📊 Data Provider' :
                           step.type === 'agent' ? '🤖 Agent Response' :
                           '⚙️ System'}
                        </span>
                        <span className="text-xs text-gray-500">
                          {step.timestamp.toLocaleTimeString()}
                        </span>
                      </div>
                      <p className="text-sm mb-1 text-gray-700">{step.message}</p>
                      {step.price && (
                        <Badge variant="secondary">
                          ${step.price}
                        </Badge>
                      )}
                    </div>
                  ))}
                </div>



                {negotiationPhase === 'payment' && (
                  <Alert className="bg-purple-50 border-purple-200">
                    <DollarSign className="h-4 w-4" />
                    <AlertDescription>
                      Processing payment... {paymentToken && `Token: ${paymentToken.substring(0, 20)}...`}
                    </AlertDescription>
                  </Alert>
                )}

                {negotiationPhase === 'complete' && (
                  <Alert className="bg-green-50 border-green-200">
                    <CheckCircle2 className="h-4 w-4" />
                    <AlertDescription className="space-y-2">
                      <p>Transaction completed successfully!</p>
                      {downloadUrl && (
                        <div className="mt-2">
                          <p className="font-semibold mb-1">Download URL:</p>
                          <code className="text-xs bg-gray-100 p-2 rounded block break-all">
                            {downloadUrl}
                          </code>
                        </div>
                      )}
                      {accessToken && (
                        <div className="mt-2">
                          <p className="font-semibold mb-1">Access Token:</p>
                          <code className="text-xs bg-gray-100 p-2 rounded block">
                            {accessToken.substring(0, 50)}...
                          </code>
                        </div>
                      )}
                      <Button 
                        onClick={resetNegotiation} 
                        className="mt-4"
                        variant="outline"
                      >
                        Start New Negotiation
                      </Button>
                    </AlertDescription>
                  </Alert>
                )}

                {isProcessing && (
                  <div className="flex items-center justify-center p-4">
                    <Loader2 className="w-6 h-6 animate-spin text-blue-600" />
                    <span className="ml-2">Processing...</span>
                  </div>
                )}
              </div>
            )}
          </TabsContent>

          <TabsContent value="purchased" className="space-y-4 mt-4">
            {purchasedData.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                <Download className="w-12 h-12 mx-auto mb-4 text-gray-300" />
                <p>No data purchased yet</p>
                <p className="text-sm mt-2">Purchased datasets will appear here</p>
              </div>
            ) : (
              <div className="space-y-4">
                {purchasedData.map((purchase) => {
                  const Icon = categoryIcons[dataCatalogue.find(r => r.id === purchase.resourceId)?.category as keyof typeof categoryIcons] || Database
                  
                  return (
                    <Card key={`${purchase.resourceId}-${purchase.purchaseDate.getTime()}`} className="p-4">
                      <div className="flex items-start justify-between">
                        <div className="flex items-start space-x-4">
                          <div className="p-3 bg-green-100 rounded-lg">
                            <Icon className="w-6 h-6 text-green-700" />
                          </div>
                          <div className="flex-1">
                            <h3 className="font-semibold text-lg mb-1">{purchase.name}</h3>
                            <p className="text-gray-600 text-sm mb-2">{purchase.description}</p>
                            <div className="flex items-center space-x-4 text-sm">
                              <Badge variant="secondary">{purchase.format}</Badge>
                              <span className="text-gray-500">{purchase.size}</span>
                              <span className="font-semibold text-green-600">
                                Purchased for ${purchase.purchasePrice}
                              </span>
                              <span className="text-gray-500">
                                {purchase.purchaseDate.toLocaleString()}
                              </span>
                            </div>
                            <div className="mt-3 p-3 bg-gray-50 rounded-lg">
                              <p className="text-xs font-semibold text-gray-700 mb-2">Download Information:</p>
                              <div className="space-y-1">
                                <div className="flex items-center text-xs">
                                  <span className="font-medium text-gray-600 w-20">URL:</span>
                                  <code className="bg-white px-2 py-1 rounded border text-gray-800 flex-1 truncate">
                                    {purchase.downloadUrl}
                                  </code>
                                </div>
                                <div className="flex items-center text-xs">
                                  <span className="font-medium text-gray-600 w-20">Token:</span>
                                  <code className="bg-white px-2 py-1 rounded border text-gray-800">
                                    {purchase.accessToken.substring(0, 20)}...
                                  </code>
                                </div>
                              </div>
                            </div>
                          </div>
                        </div>
                        <div className="flex flex-col items-end space-y-2">
                          <Button
                            variant="default"
                            onClick={() => {
                              navigator.clipboard.writeText(purchase.downloadUrl)
                              toast.success('Download URL copied to clipboard!')
                            }}
                          >
                            <ExternalLink className="w-4 h-4 mr-2" />
                            Copy URL
                          </Button>
                          <Badge className="bg-green-100 text-green-800">
                            <CheckCircle2 className="w-3 h-3 mr-1" />
                            Purchased
                          </Badge>
                        </div>
                      </div>
                    </Card>
                  )
                })}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </Card>
    </div>
  )
}