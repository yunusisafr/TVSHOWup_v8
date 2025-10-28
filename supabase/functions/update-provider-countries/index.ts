import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'npm:@supabase/supabase-js@2'

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, {
      headers: corsHeaders,
      status: 204,
    });
  }

  try {
    // Initialize Supabase client
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    const { action, providers } = await req.json()

    if (action === 'update-provider-countries') {
      console.log(`🌍 Updating supported countries for ${providers.length} providers`)
      
      let updated = 0
      let errors = 0
      
      for (const providerUpdate of providers) {
        try {
          // Update provider with supported countries
          const { error } = await supabaseClient
            .from('providers')
            .update({
              supported_countries: providerUpdate.countries,
              updated_at: new Date().toISOString()
            })
            .ilike('name', `%${providerUpdate.name}%`)
          
          if (error) {
            console.error(`❌ Error updating ${providerUpdate.name}:`, error)
            errors++
          } else {
            console.log(`✅ Updated ${providerUpdate.name} with ${providerUpdate.countries.length} countries`)
            updated++
          }
        } catch (error) {
          console.error(`❌ Error processing ${providerUpdate.name}:`, error)
          errors++
        }
      }
      
      return new Response(
        JSON.stringify({
          success: true,
          message: `Updated ${updated} providers, ${errors} errors`,
          updated,
          errors,
          timestamp: new Date().toISOString()
        }),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 200,
        }
      );
    }

    return new Response(
      JSON.stringify({
        success: false,
        error: "Unknown action",
        timestamp: new Date().toISOString()
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 400,
      }
    );

  } catch (error) {
    console.error("Error:", error);
    
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message,
        timestamp: new Date().toISOString()
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 500,
      }
    );
  }
});