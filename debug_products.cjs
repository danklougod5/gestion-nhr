
const fs = require('fs');
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://kjebadvveghiahmiqnin.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtqZWJhZHZ2ZWdoaWFobWlxbmluIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzAzMjAxNTcsImV4cCI6MjA4NTg5NjE1N30.7GjIWOg_Ow9nLscnEY5fqVez2kBcF4PTRT9MO0LwKzE';

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function checkProducts() {
    try {
        const { data, error } = await supabase
            .from('products')
            .select('*');

        if (error) {
            fs.writeFileSync('debug_output.json', JSON.stringify({ error }, null, 2));
            return;
        }

        fs.writeFileSync('debug_output.json', JSON.stringify(data, null, 2));

    } catch (e) {
        fs.writeFileSync('debug_output.json', JSON.stringify({ exception: e.message }, null, 2));
    }
}

checkProducts();
