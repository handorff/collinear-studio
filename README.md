# Collinear Studio

A full-page, animated project grid built with HTML, CSS, and JavaScript. It runs without a build step or external dependencies.

## Preview

Open `index.html` in a browser, or run `python3 -m http.server 8000` from this directory and visit <http://localhost:8000>.

## Deploy to GitHub Pages

1. Push these files to a GitHub repository.
2. In **Settings → Pages**, choose **Deploy from a branch**.
3. Select your publishing branch and **/ (root)**, then save.

The site uses relative asset paths so it works at a GitHub Pages project URL or a custom domain. The empty `.nojekyll` file serves the files as-is.

## Edit projects

Each `project-point` link in `index.html` supplies its destination, project name, summary, and outbound link label. To add a project, duplicate a link and update those fields. The grid picks a slope on each page load and spaces the points evenly in document order. With JavaScript disabled, the points link directly to the projects.

Now Arriving links to its storefront. Pasta Standards Manual links to its public GitHub repository. When the storefront has a public URL, update the corresponding destination and link label in `index.html`.
