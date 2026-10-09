import SearchOffRounded from "@mui/icons-material/SearchOffRounded";
import { Button } from "@mui/material";
import { Link as RouterLink } from "react-router-dom";
import { EmptyState } from "../components/ui";

export function NotFoundPage() {
  return (
    <EmptyState
      icon={<SearchOffRounded />}
      title="Deze pagina bestaat niet"
      action={
        <Button variant="contained" component={RouterLink} to="/">
          Naar het overzicht
        </Button>
      }
    >
      Misschien is de link verouderd. Vanuit het overzicht kom je overal.
    </EmptyState>
  );
}
