import { Component, type ReactNode, type ErrorInfo } from "react";
import { Button } from "@/components/ui/button";
import { AlertTriangle, RefreshCw } from "lucide-react";

interface Props {
	children: ReactNode;
}

interface State {
	hasError: boolean;
	error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
	state: State = {
		hasError: false,
		error: null,
	};

	static getDerivedStateFromError(error: Error): State {
		return { hasError: true, error };
	}

	componentDidCatch(error: Error, errorInfo: ErrorInfo) {
		console.error("ErrorBoundary caught an error:", error, errorInfo);
	}

	handleReload = () => {
		this.setState({ hasError: false, error: null });
		window.location.reload();
	};

	render() {
		if (this.state.hasError) {
			return (
				<div className="h-full w-full flex flex-col items-center justify-center bg-background text-foreground gap-4 p-6">
					<div className="flex items-center justify-center w-12 h-12 rounded-full bg-destructive/10">
						<AlertTriangle className="w-6 h-6 text-destructive" />
					</div>
					<div className="text-center space-y-2">
						<h2 className="text-lg font-semibold">Something went wrong</h2>
						<p className="text-sm text-muted-foreground max-w-md">
							{this.state.error?.message || "An unexpected error occurred"}
						</p>
					</div>
					<Button onClick={this.handleReload} className="gap-2">
						<RefreshCw className="w-4 h-4" />
						Reload App
					</Button>
				</div>
			);
		}

		return this.props.children;
	}
}
