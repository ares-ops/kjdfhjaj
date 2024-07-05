import { useState } from "react";
import logo from "../assets/logo.webp";
import { Link } from "react-router-dom";
import { WalletMultiButton } from "@solana/wallet-adapter-react-ui";
import { useWallet } from "@solana/wallet-adapter-react";

const admin = process.env.REACT_APP_ADMIN_ADDRESS;
function Header() {
  // State to control the visibility of the menu
  const [isMenuVisible, setMenuVisible] = useState(false);
  const wallet = useWallet();

  // Function to toggle the menu visibility
  const toggleMenu = () => {
    setMenuVisible(!isMenuVisible);
  };

  // Function to close the menu when clicked outside
  const handleOutsideClick = (e) => {
    if (!document.getElementById("menu").contains(e.target)) {
      setMenuVisible(false);
    }
  };

  return (
    <>
      <nav className="px-4 py-2 bg-transparent md:mt-0">
        <div className="flex items-center justify-between max-w-6xl mx-auto">
          {/* Hamburger Menu for small screens (left-aligned) */}
          <button onClick={toggleMenu} className="md:hidden text-white focus:outline-none text-3xl">
            <i className="fas fa-bars"></i>
          </button>

          {/* Logo (hidden on small screens) */}
          <Link to="/">
            <div className="flex-shrink-0 hidden md:block">
              <div className="logo-container">
                <img src={logo} alt="Logo" className="h-8 logo-image" />

                <span className="logo-text">AIChainCoin Staking</span>
              </div>
            </div>
          </Link>

          {/* Center the links on larger screens */}
          <div className="hidden md:flex flex-row justify-center">
            <Link to="/stake" className="block px-4 py-4 text-md text-white hover:bg-purple-medium">
              Stake
            </Link>
            <Link to="/unstake" className="block px-4 py-4 text-md text-white hover:bg-purple-medium">
              Unstake
            </Link>
            <Link to="/claim-rewards" className="block px-4 py-4 text-md text-white hover:bg-purple-medium">
              Claim Rewards
            </Link>
            <Link to="/advanced-rewards-view" className="block px-4 py-4 text-md text-white hover:bg-purple-medium">
              Advanced User Rewards
            </Link>
            {/* {wallet?.publicKey?.toBase58() == admin && ( */}
            <Link to="/admin-dashboard" className="block px-4 py-4 text-md text-white hover:bg-purple-medium">
              Admin Dashboard
            </Link>
            {/* )} */}
          </div>

          {/* Connect Wallet Button (ensure it's not hidden) */}
          <div className="flex items-center">
            <WalletMultiButton className="wallet-adapter-button" />
          </div>
        </div>
      </nav>

      <div id="menu" className={`bg-black ${isMenuVisible ? "" : "hidden"} full-width-dropdown`} onClick={handleOutsideClick}>
        <div className="flex-shrink-0 mt-3 ml-3">
          <div className="logo-container">
            <img src={logo} alt="Logo" className="h-8 logo-image" />
            <span className="logo-text">SHIDONK</span>
            {/* Close icon added here */}
            <button
              onClick={(e) => {
                toggleMenu();
                e.stopPropagation();
              }}
              className="text-white close-icon"
              id="closeButton"
            >
              <i className="fas fa-times"></i>
            </button>
          </div>
        </div>
        <div className="max-w-6xl mx-auto py-2">
          <Link to="/stake" className="block px-4 py-4 text-md text-white hover:bg-purple-medium">
            Stake
          </Link>
          <Link to="/unstake" className="block px-4 py-4 text-md text-white hover:bg-purple-medium">
            Unstake
          </Link>
          <Link to="/claim-rewards" className="block px-4 py-4 text-md text-white hover:bg-purple-medium">
            Claim Rewards
          </Link>
          <Link to="/advanced-rewards-view" className="block px-4 py-4 text-md text-white hover:bg-purple-medium">
            Advanced Rewards View
          </Link>
          {/* {wallet?.publicKey?.toBase58() == admin && ( */}
          <Link to="/admin-dashboard" className="block px-4 py-4 text-md text-white hover:bg-purple-medium">
            Admin Dashboard
          </Link>
          {/* )} */}
        </div>
      </div>
    </>
  );
}

export default Header;
