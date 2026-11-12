<script>
  import { page } from '$app/stores';
</script>

<nav>
  <a href="/">Home</a>
</nav>

<main>
  <slot />
</main>

<style>
  nav {
    padding: 1rem;
    border-bottom: 1px solid #eee;
  }
  nav a {
    margin-right: 1rem;
  }
  main {
    padding: 1rem;
    max-width: 1200px;
    margin: 0 auto;
  }
</style>
