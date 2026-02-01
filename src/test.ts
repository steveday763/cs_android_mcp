/**
 * Test script for Android Code Search API
 */

import { searchCode, getSuggestions, getFileContents, getAvailableProjects } from './api.js';

async function testSearch() {
  console.log('=== Testing Search API ===\n');

  try {
    const results = await searchCode({
      query: 'class Activity extends',
      pageSize: 3,
    });

    console.log('Search Results:');
    if (results.searchResults) {
      results.searchResults.forEach((result, i) => {
        const file = result.fileSearchResult?.fileSpec;
        if (file) {
          console.log(`${i + 1}. ${file.path}`);
          console.log(`   Project: ${file.sourceRoot.repositoryKey.ossProject}`);
          console.log(`   Repo: ${file.sourceRoot.repositoryKey.repositoryName}`);
        }
      });
    }
    console.log('\n');
  } catch (error) {
    console.error('Search failed:', error);
  }
}

async function testSuggestions() {
  console.log('=== Testing Suggestions API ===\n');

  try {
    const results = await getSuggestions('Activity', 5);

    console.log('Suggestions:');
    results.suggestions.forEach((s, i) => {
      console.log(`${i + 1}. [${s.symbol?.type || 'FILE'}] ${s.title}`);
      console.log(`   Path: ${s.fileSpec.path}`);
    });
    console.log('\n');
  } catch (error) {
    console.error('Suggestions failed:', error);
  }
}

async function testFileContent() {
  console.log('=== Testing File Content API ===\n');

  try {
    const content = await getFileContents(
      'android-studio',
      'platform/tools/base',
      'mirror-goog-studio-main',
      'fakeandroid/srcs/android/app/Activity.java'
    );

    console.log('File Content (first 500 chars):');
    console.log(content.content.substring(0, 500));
    console.log('...');
    console.log(`\nTotal size: ${content.size} bytes`);
    console.log(`MIME type: ${content.mimeType}`);
    console.log('\n');
  } catch (error) {
    console.error('File content failed:', error);
  }
}

async function testProjects() {
  console.log('=== Available Projects ===\n');

  const projects = getAvailableProjects();
  projects.forEach(p => {
    console.log(`- ${p.name} (${p.id}): ${p.description}`);
  });
  console.log('\n');
}

async function main() {
  console.log('Android Code Search API Test\n');
  console.log('============================\n');

  await testProjects();
  await testSuggestions();
  await testSearch();
  await testFileContent();

  console.log('All tests completed!');
}

main().catch(console.error);
