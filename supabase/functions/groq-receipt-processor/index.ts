import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { imageData, inputType, data } = await req.json()

    const groqApiKey = Deno.env.get('GROQ_API_KEY')
    if (!groqApiKey) {
      throw new Error('GROQ_API_KEY not configured')
    }

    let messages = []

    if (inputType === 'image') {
      messages = [
        {
          role: 'system',
          content: 'You are a carbon footprint analysis expert. Analyze receipt images and extract all items with accurate carbon footprint calculations. Return a JSON object with: store_name, date, items array, and total_carbon_footprint. Each item must have: name, quantity, unit_price, carbon_footprint_kg (use these reference values: beef 27kg/kg, lamb 24kg/kg, pork 7.2kg/kg, chicken 6.9kg/kg, cheese 13.5kg/kg, milk 3.2kg/L, rice 4kg/kg, bread 1.6kg/kg, tomatoes 2.1kg/kg, bananas 0.7kg/kg, coffee 15kg/kg), category (beef/lamb/pork/chicken/dairy/produce/grains/beverages/other), and carbon_intensity (high >10kg, medium 2-10kg, low <2kg). Be precise with quantities and use standard units.'
        },
        {
          role: 'user',
          content: [
            {
              type: 'text',
              text: 'Please analyze this receipt and provide the carbon footprint data in JSON format'
            },
            {
              type: 'image_url',
              image_url: {
                url: imageData
              }
            }
          ]
        }
      ]
    } else if (inputType === 'manual') {
      messages = [
        {
          role: 'system',
          content: 'You are a carbon footprint analysis expert. Analyze manual receipt data and calculate accurate carbon footprints. Return a JSON object with: store_name, date, items array, and total_carbon_footprint. Each item must have: name, quantity, unit_price, carbon_footprint_kg (use these reference values: beef 27kg/kg, lamb 24kg/kg, pork 7.2kg/kg, chicken 6.9kg/kg, cheese 13.5kg/kg, milk 3.2kg/L, rice 4kg/kg, bread 1.6kg/kg, tomatoes 2.1kg/kg, bananas 0.7kg/kg, coffee 15kg/kg), category (beef/lamb/pork/chicken/dairy/produce/grains/beverages/other), and carbon_intensity (high >10kg, medium 2-10kg, low <2kg). Calculate based on actual product types and weights.'
        },
        {
          role: 'user',
          content: [
            {
              type: 'text',
              text: `Please analyze this manual receipt data: ${JSON.stringify(data)}`
            }
          ]
        }
      ]
    } else if (inputType === 'barcode') {
      messages = [
        {
          role: 'system',
          content: 'Analyze barcode data and provide product information with carbon footprint. Return a JSON object with: name, brand, carbon footprint in kg CO2e, category (low/medium/high), and details object containing material, origin, transport, and packaging information. Use typical values for common products.'
        },
        {
          role: 'user',
          content: [
            {
              type: 'text',
              text: `Please analyze this barcode: ${data} and provide product information`
            }
          ]
        }
      ]
    }

    const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${groqApiKey}`,
      },
      body: JSON.stringify({
        messages,
        model: 'meta-llama/llama-4-maverick-17b-128e-instruct',
        temperature: 1,
        max_completion_tokens: 1024,
        top_p: 1,
        stream: false,
        response_format: {
          type: 'json_object'
        },
        stop: null
      }),
    })

    if (!response.ok) {
      const errorData = await response.json()
      console.error('Groq API error:', errorData)
      throw new Error(errorData.error?.message || `Groq API error: ${response.status}`)
    }

    const result = await response.json()
    const parsedResult = JSON.parse(result.choices[0].message.content)

    return new Response(
      JSON.stringify({ success: true, data: parsedResult }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      },
    )

  } catch (error) {
    console.error('Error in groq-receipt-processor:', error)
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error.message 
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      },
    )
  }
})