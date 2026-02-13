
const fs = require('fs');
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://kjebadvveghiahmiqnin.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtqZWJhZHZ2ZWdoaWFobWlxbmluIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzAzMjAxNTcsImV4cCI6MjA4NTg5NjE1N30.7GjIWOg_Ow9nLscnEY5fqVez2kBcF4PTRT9MO0LwKzE';

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function checkProducts() {
    try {
        const { data, error } = await supabase
            .from('products')
            .select('name,category,site');

        if (error) {
            console.log("Error:", error);
            return;
        }

        console.log("--- START LIST ---");
        data.forEach(p => {
            console.log(`[${p.site}] ${p.name} (${p.category})`);
        });
        console.log("--- END LIST ---");

    } catch (e) {
        console.log("Exception:", e);
    }
}

checkProducts();
