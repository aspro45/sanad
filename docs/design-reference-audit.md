# SANAD Design Reference Audit

Date: 2026-06-23
Scope: local frontend direction for SANAD. No GitHub push. No Vercel deploy.

## North Star

SANAD should feel like a major humanitarian-fintech foundation with a real Arc settlement rail behind it. The first impression must be human, trustworthy, premium, and useful. The contract rail is proof, not the whole visual identity.

Do not return to the old dark terminal/dashboard composition. The site needs a new foundation-style surface: real-looking imagery, editorial structure, clear mission, impact, and one usable live workflow.

## What The References Teach

### Foundation Reference

- https://www.samdayfoundation.org/
  Use the structure: mission first, emotional story, impact numbers, programs, get involved, sponsors/partners, donation-style calls to action. For SANAD this becomes: problem, who it helps, how private bill aid works, live proof, and builder resources.
  Do not copy the exact visual style or content. Use the lesson: human cause before technology.

### Arc References

- https://www.arc.io/
  Use Arc as the technical credibility layer: stablecoin-native finance, predictable fees, deterministic settlement, privacy when needed, and real-world financial flows.

- https://docs.arc.io/
  Use as the builder proof source. Any developer links on SANAD should point here.

- https://faucet.circle.com/
  Keep as a utility link for testnet funds.

- https://testnet.arcscan.app/
  Keep as the proof/explorer link for deployed contract and transaction evidence.

- https://www.arc.io/app-kits
  Use as future integration direction, not as decoration.

- https://www.arc.io/ecosystem
  Use to position SANAD as part of an ecosystem, not a standalone toy.

- https://www.arc.io/blog
  Use only as a resource link.

- https://www.arc.io/litepaper
  Use for deeper architecture reading.

- https://www.arc.io/arc-token-whitepaper
  Use as an advanced reference link only.

- https://www.arc.io/post-quantum-whitepaper
  Use as a credibility link for long-term security context.

- Arc privacy whitepaper PDF
  Use the idea: selective disclosure, encrypted evidence, public proof. SANAD should show private fields hidden and hashes/memos visible.

### 3D And Spatial Libraries

- https://github.com/mrdoob/three.js/
  Powerful for custom WebGL scenes. Use only if the 3D scene explains private settlement, not for random cubes or decoration.

- https://github.com/pmndrs/react-three-fiber
  Best React path if we add a real 3D scene later. Use for a clean React + Three architecture.

- https://github.com/aframevr/aframe
  Good for VR/WebXR style experiences. Not needed for the main website unless we build an immersive aid-flow room.

- https://aframe.io/docs/1.7.0/introduction/
  Same decision: useful reference, not current main stack.

- https://github.com/CesiumGS/cesium
  Good for globe, maps, geospatial proof, cross-border aid routing. Use later if SANAD needs a world map of verified payout corridors.

- https://github.com/metafizzy/zdog
  Lightweight pseudo-3D. Could fit small friendly icons, but not the main product surface.

- https://github.com/tengbao/vanta
  Background effects. Avoid for SANAD unless subtle and purposeful; decorative animated backgrounds can make the project feel less serious.

- https://github.com/micku7zu/vanilla-tilt.js
  Use sparingly for cards/images. Do not make the UI feel like a gimmick.

- https://app.spline.design/home
  Good for polished 3D assets. Use if we create a real hero object, not if it becomes unrelated decoration.

- https://github.com/isl-org/Open3D
  More research/3D processing than website UI. Not needed for this frontend.

- https://shaders.com/
  Use as inspiration for high-end visual texture. Avoid heavy shader-only design.

### Motion And Interaction

- https://gsap.com/
  Best for advanced scroll and timeline motion. Use for guided aid-flow storytelling if needed.

- https://motion.dev/docs/ai-kit
  Good for motion quality checks and animation guidelines. Use for subtle page transitions and component movement.

- https://d3js.org/
  Use if SANAD needs real impact charts: requests verified, average time to payout, volume routed.

### Canvas, 2D, And Game-Style Rendering

- https://konvajs.org/
  Useful for interactive diagrams or editable proof packets. Not needed for basic layout.

- https://pixijs.com/
  Useful for high-performance 2D visuals. Not needed unless we create a rich animated impact map.

### UI Frameworks And CSS Systems

- https://nextjs.org/
  Good future production framework. Current Vite app is fine locally; move only when there is a real reason.

- https://www.tailwindapp.com/
  Tailwind ecosystem reference. Do not add unless we decide to migrate styling.

- https://get.foundation/
  UI framework reference. No need to install.

- https://getuikit.com/
  UI framework reference. No need to install.

- https://pure-css.github.io/
  Minimal CSS reference. No need to install.

- http://getskeleton.com/
  Lightweight layout reference. No need to install.

- https://milligram.io/
  Minimal CSS reference. No need to install.

- https://tachyons.io/
  Utility CSS reference. No need to install.

- https://bulma.io/
  Component style reference. No need to install.

- https://semantic-ui.com/
  Semantic component reference. No need to install.

- https://webawesome.com/docs/components/skeleton/
  Use the idea of professional loading states if the app waits for wallet/contract.

- https://github.com/imyt/skeleton-templates
  Skeleton layout inspiration only.

### Visual Inspiration And Taste

- https://softrankings.com/
  Reference for clean SaaS credibility, structured comparisons, and polished density.

- https://designspells.com/
  Reference for small interaction details. Use for hover states, reveals, and micro-polish.

- https://mobbin.com/discover/apps/ios/latest
  Reference for mobile polish and real product flow patterns.

- https://godly.website/
  Reference for contemporary art direction and layout confidence.

- https://www.awwwards.com/websites/3d/
  Reference for premium 3D websites. Use taste, not visual noise.

- https://onepagelove.com/style/3d
  Reference for focused one-page flow.

- https://www.framer.com/community/marketplace/templates/categories/3d/
  Reference for modern landing composition.

- https://www.behance.net/search/projects/3d%20website
  Moodboard reference, not a code source.

- https://www.lapa.ninja/category/3d-websites/
  Reference for landing-page structure and visual hierarchy.

- https://dribbble.com/tags/2d-website
  2D visual language reference.

- https://dribbble.com/tags/2d-design
  2D asset style reference.

- https://www.behance.net/tags/2d
  Editorial/illustration reference.

- https://dribbble.com/tags/3d-website
  3D visual language reference.

- https://dribbble.com/search/2d-website
  2D landing reference.

- https://www.slideshare.net/slideshow/2d-web-designs/262617969
  Broad 2D layout inspiration. Low priority.

- https://www.behance.net/gallery/169131127/Website-design-3D-2D-Making-of
  Useful for process thinking: image system, sections, and polish.

### Components, Templates, And Community UI

- https://21st.dev/community/components
  Reference for component polish. Borrow ideas, not random component clutter.

- https://github.com/ibelick/ui-skills?tab=MIT-1-ov-file
  Useful as a UI pattern source if a specific component is needed.

- https://webflow.com/libraries?utm_source=marketplace
  Reference for polished sections and interaction patterns.

- https://themeforest.net/search/2d
  Broad market reference only. Avoid generic template look.

### Logos, Icons, And Illustration Sources

- https://github.com/Nutlope/hallmark
  Logo/brand-generation reference.

- https://github.com/Nutlope/logocreator
  Logo-generation reference.

- https://github.com/op7418/logo-generator-skill
  Logo workflow reference.

- https://github.com/nulla2011/bluearchive-logo
  Not relevant to SANAD brand except as typography experimentation.

- https://github.com/airyland/logo.surf
  Logo inspiration source.

- https://github.com/Arindam200/logo-ai
  Logo-generation reference.

- https://github.com/get-icon/geticon
  Icon source reference.

- https://www.untitledui.com/logos
  Brand/logo quality reference.

- https://logosystem.co/
  Use for thinking about consistent identity systems.

- https://fontawesome.com/
  Icon reference. Current app should prefer lucide icons unless a specific icon is missing.

- https://www.highlights.design/
  Visual detail reference.

- https://www.humaaans.com/
  Human illustration reference.

- https://lukaszadam.com/illustrations
  Illustration reference.

- https://3dicons.co/
  3D icon reference. Use cautiously; can look playful instead of serious.

- https://www.figma.com/community/plugin/1107546399747513238/3dicons
  Same as 3dicons.

- https://en.ac-illust.com/
  Illustration source reference.

- https://www.figma.com/@acworks
  Illustration source reference.

- https://storyset.com/
  Illustration reference, but avoid generic startup cartoons.

- https://scale.flexiple.com/illustrations/
  Illustration reference, but avoid generic stock feel.

- https://iradesign.io/?ref=uigoodies.com
  Illustration system reference.

- https://craftwork.design/search/category
  Asset/source reference.

- https://www.magnific.com/vectors/web-design-assets
  Asset reference.

- https://www.magnific.com/free-photos-vectors/web-design-assets
  Asset reference.

- https://craftpix.net/
  Game asset source. Low priority for SANAD.

### Skills And Workflow Links

- https://github.com/Leonxlnx/taste-skill
  Use the principle: taste decisions must be deliberate, not random decoration.

- https://github.com/nextlevelbuilder/ui-ux-pro-max-skill
  Use the principle: full product-quality UI, not partial sections.

- https://github.com/op7418/guizang-ppt-skill
  More relevant for decks than frontend.

- https://github.com/life-itself/web3
  Web3 conceptual reference.

- https://findskill.ai/skills/
  Skill discovery reference.

## Locked Design Decisions For SANAD

1. First viewport must be human/foundation-led, not contract-led.
2. The live Arc contract rail should sit lower on the page as proof and utility.
3. The visual style should be warm, editorial, high-trust, and premium.
4. Use Arc language for credibility: stablecoin settlement, predictable fees, privacy, deterministic proof.
5. Do not use fake claims. If data comes from the app, label it as live contract state or local demo state.
6. Do not rebuild the old left headline/right rescue desk layout.
7. Do not fill the page with random 3D effects. Any 3D/canvas/motion must explain the product.
8. Keep wallet/contract flows usable: connect, create request, verify, fund, pay, inspect proof.
9. Local first until approved. No push and no deploy without explicit confirmation.

## Current Implementation Notes

- Main frontend file: `src/App.tsx`
- Main styling file: `src/styles.css`
- Current hero asset: `public/sanad-collage-hero.png`
- Current product direction: foundation-style impact site with a real Arc proof rail.
- Next visual improvement, if needed: add a guided story sequence using GSAP/Motion, then add D3 impact charts only when real data exists.
