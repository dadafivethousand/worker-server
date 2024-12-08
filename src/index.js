export default {
    async fetch(request, env) {
        const url = new URL(request.url);

        // Handle CORS preflight requests
        if (request.method === "OPTIONS") {
            return handleOptions();
        }

        // Handle new kids subscription requests
        if (url.pathname === "/new_kids_subscription" && request.method === "POST") {
            return await handleCheckoutSession(request, env);
        }

        // Return 404 for other routes
        return new Response("Not Found", { status: 404 });
    },
};

// Handle CORS preflight requests
function handleOptions() {
    return new Response(null, {
        status: 204,
        headers: corsHeaders(),
    });
}

// Main function to create a Stripe Checkout Session
async function handleCheckoutSession(request, env) {
    try {
        const { kids, parentEmail } = await request.json();
        validateInput({ kids, parentEmail });
        const customerId = await CreateCustomer(env, parentEmail);
        const totalPrice = calculatePrice(kids);
        const checkoutSession = await createStripeCheckoutSession(env, customerId, totalPrice, kids);
        return jsonResponse({ url: checkoutSession.url });
    } catch (error) {
        console.error("Error creating checkout session:", error);
        return jsonResponse({ error: error.message }, 500);
    }
}

// Validate input data
function validateInput({ kids, parentEmail }) {
    if (!parentEmail || typeof parentEmail !== "string") {
        throw new Error("Invalid parent email");
    }
    if (!Array.isArray(kids) || kids.length === 0) {
        throw new Error("Invalid kids data");
    }
}

// Fetch or create a Stripe customer
async function CreateCustomer(env, parentEmail) {
 
    const response = await stripeRequest(env, "customers", "POST", { email: parentEmail });
    const customerId = response.id;

    // Cache the customer ID
 

    return customerId;
}

// Create a Stripe Checkout Session
 

async function createStripeCheckoutSession(env, customerId, totalPrice, kids) {
    const sessionData = await stripeRequest(env, "checkout/sessions", "POST", {
        mode: "subscription",
        customer: customerId,
        "line_items[0][price_data][currency]": "cad",
        "line_items[0][price_data][product]": "prod_RLVSUJTJgp68MG",
        "line_items[0][price_data][unit_amount]": totalPrice,
        "line_items[0][price_data][recurring][interval]": "month",
        "line_items[0][quantity]": 1,
        success_url: "https://yourdomain.com/success?session_id={CHECKOUT_SESSION_ID}",
        cancel_url: "https://yourdomain.com/cancel",
        metadata: {
            kids: JSON.stringify(kids), // Plain object
        },
        subscription_data: {
            metadata: {
                kids: JSON.stringify(kids), // Plain object
            },
        },
    });

    return sessionData;
}



// Calculate the total subscription price
function calculatePrice(kids) {
    const basePrice = 160 * 100; // Base price per kid in cents
    return kids.reduce((total, _, index) => total + basePrice * (1 - (index > 0 ? 0.2 * index : 0)), 0);
}

// Helper function for making Stripe API requests
async function stripeRequest(env, endpoint, method, body) {
    const params = new URLSearchParams();

    Object.entries(body).forEach(([key, value]) => {
        if (typeof value === "object" && value !== null) {
            // Handle nested objects
            Object.entries(value).forEach(([nestedKey, nestedValue]) => {
                if (typeof nestedValue === "object") {
                    // Handle deeper nesting
                    Object.entries(nestedValue).forEach(([deepKey, deepValue]) => {
                        params.append(`${key}[${nestedKey}][${deepKey}]`, deepValue);
                    });
                } else {
                    params.append(`${key}[${nestedKey}]`, nestedValue);
                }
            });
        } else {
            params.append(key, value);
        }
    });

    console.log("Final Stripe request body:", params.toString());

    const response = await fetch(`https://api.stripe.com/v1/${endpoint}`, {
        method,
        headers: {
            Authorization: `Bearer ${env.STRIPE_API_KEY}`,
            "Content-Type": "application/x-www-form-urlencoded",
        },
        body: params,
    });

    const data = await response.json();
    if (!response.ok) {
        throw new Error(data.error?.message || "Stripe API error");
    }

    return data;
}



// Helper function to send JSON responses
function jsonResponse(data, status = 200) {
    return new Response(JSON.stringify(data), {
        status,
        headers: { "Content-Type": "application/json", ...corsHeaders() },
    });
}

// Common CORS headers
function corsHeaders() {
    return {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type, Authorization",
    };
}
