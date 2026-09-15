<?php
/**
 * Copy this to  config.php  (same folder) ON THE SERVER and paste your key.
 * config.php is gitignored and excluded from FTP deploys, so it is never
 * overwritten or committed. Alternatively set an ANTHROPIC_API_KEY env var
 * in cPanel and delete this file — the proxy checks the env var first.
 */
return [
    'ANTHROPIC_API_KEY' => 'sk-ant-your-key-here',
];
